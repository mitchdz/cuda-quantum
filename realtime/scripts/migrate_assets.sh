#!/bin/bash

# ============================================================================ #
# Copyright (c) 2022 - 2026 NVIDIA Corporation & Affiliates.                   #
# All rights reserved.                                                         #
#                                                                              #
# This source code and the accompanying materials are made available under     #
# the terms of the Apache License 2.0 which accompanies this distribution.     #
# ============================================================================ #

# This script migrates assets from an extracted installer directory to the expected locations.

# Default target location: /opt/nvidia/cudaq/realtime
target=/opt/nvidia/cudaq/realtime


# Process command line arguments
__optind__=$OPTIND
OPTIND=1
while getopts ":t:" opt; do
  case $opt in
    t) target="$OPTARG"
    ;;
    \?) echo "Invalid command line option -$OPTARG" >&2
    (return 0 2>/dev/null) && return 1 || exit 1
    ;;
  esac
done
OPTIND=$__optind__

mkdir -p "$target"

# Generate an uninstall script that removes files installed by this script.
uninstall_script="$target/uninstall.sh"
target_quoted=$(printf '%q' "$target")

cat > "$uninstall_script" <<EOF
#!/bin/bash
set -euo pipefail

target=$target_quoted

echo "This will remove CUDA-Q Realtime files installed under \$target."
read -r -p "Continue? [y/N] " answer
case "\${answer,,}" in
  y|yes) ;;
  *) echo "Aborted."; exit 1 ;;
esac

EOF

chmod a+x "$uninstall_script"

echo "Migrating assets to $target..."
echo "An uninstall script will be created at: $uninstall_script"

find . -type f -print0 | while IFS= read -r -d '' file;
do 
    # Don't attempt to migrate the installer script itself.
    if [ "$file" = "./install.sh" ]; then
        continue
    fi

    echo "Processing $file..."  
    if [ ! -f "$target/$file" ]; then 
        # Move the file to the target location, preserving directory structure
        target_path="$target/$(dirname "$file")"
        mkdir -p "$target_path"
        mv "$file" "$target_path/"
        echo "Moved $file to $target_path/"

        # Record removal step for this file in the uninstall script.
        echo "rm -f \"\$target/$file\"" >> "$uninstall_script"
    else
        echo "File $target/$file already exists, skipping."
    fi    
done

# Clean up now-empty directories on uninstall.
echo 'find "$target" -type d -empty -delete' >> "$uninstall_script"