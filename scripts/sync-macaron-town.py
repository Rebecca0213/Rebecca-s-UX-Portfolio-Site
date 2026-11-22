#!/usr/bin/env python3
"""Port the macaron-town Vite project into plain ES modules this static site can serve.

The site has no build step and no Node, so the four Vite-only features the town relies on are
resolved ahead of time here: `import.meta.glob` (the asset registry and the texture recipes),
`?raw` GLSL imports, `import.meta.env.DEV`, and CSS imports. `three` and `gsap` are vendored out
of the town's node_modules and reached through the import map in index.html.

Re-run this after changing the town; it owns macaron-town/src and macaron-town/vendor entirely
and leaves the hand-written entry (macaron-town/island.js, island.css) alone.

    python3 scripts/sync-macaron-town.py [path-to-macaron-town]
"""

import json
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SRC = Path.home() / "claude_physicalai" / "macaron-town"
DEST = REPO / "macaron-town"

# Dev-only entry points the hero never reaches. main.js is replaced by island.js.
SKIP_DIRS = {"dev"}
SKIP_FILES = {"main.js"}

# Bare specifiers that stay bare and are satisfied by the import map.
THREE_ENTRIES = [
    "controls/OrbitControls.js",
    "geometries/RoundedBoxGeometry.js",
    "postprocessing/EffectComposer.js",
    "postprocessing/GTAOPass.js",
    "postprocessing/OutputPass.js",
    "postprocessing/Pass.js",
    "postprocessing/SMAAPass.js",
    "postprocessing/ShaderPass.js",
    "postprocessing/UnrealBloomPass.js",
    "shaders/CopyShader.js",
    "shaders/OutputShader.js",
    "utils/BufferGeometryUtils.js",
]

SPECIFIER = re.compile(
    r"""(?:^|[^\w$.])(?:import|export)\s*(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]"""
)
DYNAMIC_IMPORT = re.compile(r"""\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)""")


def log(message):
    print(f"  {message}")


def as_template_literal(text):
    """Wrap a GLSL source in a template literal, neutralising its three escapes."""
    escaped = text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    return f"export default `{escaped}`;\n"


def specifiers(source):
    return set(SPECIFIER.findall(source)) | set(DYNAMIC_IMPORT.findall(source))


# ── The town's own source ────────────────────────────────────────────────────────────────────


def glsl_modules(src_root, dest_root):
    """Rewrite every .glsl as a .glsl.js exporting its source, so no loader is needed."""
    count = 0
    for path in sorted((src_root / "src").rglob("*.glsl")):
        target = dest_root / "src" / path.relative_to(src_root / "src")
        target = target.with_suffix(target.suffix + ".js")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(as_template_literal(path.read_text()))
        count += 1
    log(f"{count} GLSL modules")


def rewrite_registry(source, src_root):
    """`import.meta.glob(['./**/*.js', ...])` -> an explicit map of lazy imports."""
    paths = sorted(
        f"./{p.relative_to(src_root / 'src' / 'assets').as_posix()}"
        for p in (src_root / "src" / "assets").rglob("*.js")
        if p.name != "registry.js"
    )
    entries = ",\n".join(f"  '{p}': () => import('{p}')" for p in paths)
    return re.sub(
        r"const MODULES = import\.meta\.glob\([\s\S]*?\);",
        f"const MODULES = {{\n{entries},\n}};",
        source,
        count=1,
    )


def rewrite_bakery(source, src_root):
    """`import.meta.glob('./recipes/*.glsl', { eager: true })` -> eager static imports."""
    recipes = sorted((src_root / "src" / "textures" / "recipes").glob("*.glsl"))
    imports = "\n".join(
        f"import recipe_{p.stem} from './recipes/{p.name}.js';" for p in recipes
    )
    entries = ",\n".join(f"  './recipes/{p.name}': recipe_{p.stem}" for p in recipes)
    source = re.sub(
        r"const RECIPES = import\.meta\.glob\([\s\S]*?\);",
        f"{imports}\n\nconst RECIPES = {{\n{entries},\n}};",
        source,
        count=1,
    )
    return source


def port_source(src_root, dest_root):
    """Copy the town's JS, resolving the Vite-only syntax as it goes."""
    count = 0
    for path in sorted((src_root / "src").rglob("*.js")):
        relative = path.relative_to(src_root / "src")
        if set(relative.parts[:-1]) & SKIP_DIRS or relative.name in SKIP_FILES:
            continue

        source = path.read_text()
        if relative == Path("assets/registry.js"):
            source = rewrite_registry(source, src_root)
        elif relative == Path("textures/Bakery.js"):
            source = rewrite_bakery(source, src_root)

        # `?raw` GLSL imports point at the generated modules instead.
        source = re.sub(r"(\.glsl)\?raw(['\"])", r"\1.js\2", source)
        # No bundler, so no dev build; the branches this guards are dropped by the engine.
        source = source.replace("import.meta.env.DEV", "false")
        # Stylesheets are linked from the page rather than imported by a module.
        source = re.sub(r"^import\s+['\"][^'\"]+\.css['\"];\s*\n", "", source, flags=re.M)

        target = dest_root / "src" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source)
        count += 1
    log(f"{count} JS modules")

    styles = dest_root / "styles"
    styles.mkdir(parents=True, exist_ok=True)
    for path in sorted((src_root / "src" / "styles").glob("*.css")):
        shutil.copy2(path, styles / path.name)
    log(f"{len(list(styles.glob('*.css')))} stylesheets")


def check_leftovers(dest_root):
    """Nothing Vite-only may survive into the shipped copy."""
    bad = []
    for path in sorted((dest_root / "src").rglob("*.js")):
        source = path.read_text()
        for token in ("import.meta.glob", "import.meta.env", "import.meta.hot", "?raw"):
            if token in source:
                bad.append(f"{path.relative_to(dest_root)}: {token}")
    if bad:
        raise SystemExit("Vite-only syntax survived the port:\n  " + "\n  ".join(bad))


# ── Vendored dependencies ────────────────────────────────────────────────────────────────────


def copy_module_graph(entries, resolve, dest_root, label):
    """Walk relative imports from `entries` and copy every module reached."""
    queue = list(entries)
    seen = set()
    while queue:
        source_path = queue.pop()
        if source_path in seen:
            continue
        seen.add(source_path)
        text = source_path.read_text()
        target = dest_root / resolve(source_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        for specifier in specifiers(text):
            if not specifier.startswith("."):
                continue
            nested = (source_path.parent / specifier).resolve()
            if nested.exists() and nested.suffix == ".js":
                queue.append(nested)
    log(f"{len(seen)} {label} modules")


def vendor(src_root, dest_root):
    modules = src_root / "node_modules"
    vendor_root = dest_root / "vendor"

    three_build = vendor_root / "three" / "build"
    three_build.mkdir(parents=True, exist_ok=True)
    for name in ("three.module.js", "three.core.js"):
        shutil.copy2(modules / "three" / "build" / name, three_build / name)
    log("three core build")

    jsm = modules / "three" / "examples" / "jsm"
    copy_module_graph(
        [jsm / entry for entry in THREE_ENTRIES],
        lambda p: Path("vendor/three/examples/jsm") / p.relative_to(jsm),
        dest_root,
        "three addon",
    )

    gsap = modules / "gsap"
    copy_module_graph(
        [gsap / "index.js"],
        lambda p: Path("vendor/gsap") / p.relative_to(gsap),
        dest_root,
        "gsap",
    )


def write_import_map(dest_root):
    """index.html reads this, so the map never drifts from what was vendored."""
    base = "macaron-town/vendor"
    mapping = {
        "imports": {
            "three": f"./{base}/three/build/three.module.js",
            "three/examples/jsm/": f"./{base}/three/examples/jsm/",
            "three/addons/": f"./{base}/three/examples/jsm/",
            "gsap": f"./{base}/gsap/index.js",
        }
    }
    (dest_root / "importmap.json").write_text(json.dumps(mapping, indent=2) + "\n")
    log("import map")


def main():
    src_root = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_SRC
    if not (src_root / "src" / "app" / "World.js").exists():
        raise SystemExit(f"No macaron-town source at {src_root}")

    print(f"Porting {src_root} -> {DEST}")
    for owned in ("src", "vendor", "styles"):
        shutil.rmtree(DEST / owned, ignore_errors=True)
    DEST.mkdir(parents=True, exist_ok=True)

    glsl_modules(src_root, DEST)
    port_source(src_root, DEST)
    check_leftovers(DEST)
    vendor(src_root, DEST)
    write_import_map(DEST)
    print("Done.")


if __name__ == "__main__":
    main()
