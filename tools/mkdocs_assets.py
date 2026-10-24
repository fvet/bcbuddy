"""Publish files that live outside docs/ along with the site.

The screenshots belong in store/ because the Chrome Web Store listing is built
from that folder, the before-and-after shots of the web client in
marketing/screenshots/ are the ones the deck uses, and examples/bc-buddy.json is
the shared configuration file people point their extension at. Copying any of
them into docs/ would leave a second set to keep in step, so the site is given
the originals instead: a re-shoot updates the deck and the site at once.

They are registered as files rather than copied in after the build, so mkdocs
knows about them and --strict still catches a page linking to a screenshot that
has been renamed.
"""

from pathlib import Path

from mkdocs.structure.files import File

# Path in the repository -> path in the built site.
PUBLISHED = {
    'icons/logo.svg': 'assets/logo.svg',
    'store/screenshot-4-sales-orders-1280x800.png': 'assets/screenshot-4-sales-orders-1280x800.png',
    'store/screenshot-7-styles-1280x800.png': 'assets/screenshot-7-styles-1280x800.png',
    'store/screenshot-6-environments-1280x800.png': 'assets/screenshot-6-environments-1280x800.png',
    # Served from the site so a team can point at a stable https URL that is
    # not a raw.githubusercontent.com blob.
    'examples/bc-buddy.json': 'examples/bc-buddy.json',
}

# Folder in the repository -> folder in the built site, every file in it.
PUBLISHED_FOLDERS = {
    'marketing/screenshots': 'assets/screenshots',
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

    for source, destination in PUBLISHED_FOLDERS.items():
        folder = root / source
        if not folder.is_dir():
            raise FileNotFoundError(
                f'{source} is listed in tools/mkdocs_assets.py but is not in the repository'
            )
        for origin in sorted(folder.iterdir()):
            if origin.suffix in ('.png', '.jpg'):
                files.append(File.generated(
                    config, f'{destination}/{origin.name}', abs_src_path=str(origin)
                ))

    return files
