from pathlib import Path 
from typing import List


def list_files(path: Path) -> List[Path]:
    return list(path.glob("**/*"))


def print_directory_tree(path: Path, indent: int = 0):
    for file in list_files(path):
        print(" " * indent + file.name)
        if file.is_dir():
            print_directory_tree(file, indent + 2)