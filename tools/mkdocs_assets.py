"""Publish files that live outside docs/ along with the site.

The screenshots belong in store/ because the Chrome Web Store listing is built
from that folder, and examples/bc-buddy.json is the shared configuration file
people point their extension at. Copying either into docs/ would leave a second
set to keep in step, so the site is given the originals instead.

They are registered as files rather than copied in after the build, so mkdocs
knows about them and --strict still catches a page linking to a screenshot that
has been renamed.
"""

from pathlib import Path

from mkdocs.structure.files import File

# Path in the repository -> path in the built site.
PUBLISHED = {
    'icons/logo.svg': 'assets/logo.svg',
    'store/screenshot-1-1280x800.png': 'assets/screenshot-1-1280x800.png',
    'store/screenshot-2-1280x800.png': 'assets/screenshot-2-1280x800.png',
    'store/screenshot-3-1280x800.png': 'assets/screenshot-3-1280x800.png',
    # Served from the site so a team can point at a stable https URL that is
    # not a raw.githubusercontent.com blob.
    'examples/bc-buddy.json': 'examples/bc-buddy.json',
}


def on_files(files, config):
    root = Path(config.config_file_path).parent

    for source, destination in PUBLISHED.items():
        origin = root / source
        if not origin.is_file():
            raise FileNotFoundError(
                f'{source} is listed in tools/mkdocs_assets.py but is not in the repository'
            )
        files.append(File.generated(config, destination, abs_src_path=str(origin)))

    return files
