#!/usr/bin/env python3
"""
Script to export WaveformVisualizer.tsx and page.tsx to a text file
Created: October 22, 2025
"""

import os
from pathlib import Path

def export_file_content(file_path, display_name, output_file):
    """Export a single file's content to the output file with clear separation."""
    separator = "=" * 80
    
    if os.path.exists(file_path):
        with open(output_file, 'a', encoding='utf-8') as out:
            # Add header
            out.write(f"\n{separator}\n")
            out.write(f"FILE: {display_name}\n")
            out.write(f"PATH: {file_path}\n")
            out.write(f"{separator}\n\n")
            
            # Add file content
            with open(file_path, 'r', encoding='utf-8') as f:
                out.write(f.read())
            
            # Add footer
            out.write(f"\n\n{separator}\n")
            out.write(f"END OF FILE: {display_name}\n")
            out.write(f"{separator}\n\n")
        
        print(f"✓ Exported: {display_name}")
        return True
    else:
        print(f"✗ File not found: {file_path}")
        return False

def main():
    output_file = "exported-files.txt"
    
    # Clear the output file if it exists
    if os.path.exists(output_file):
        os.remove(output_file)
    
    print(f"\nExporting files to {output_file}...")
    
    # Export files
    files_to_export = [
        ("frontend/app/components/WaveformVisualizer.tsx", "WaveformVisualizer.tsx"),
        ("frontend/app/page.tsx", "page.tsx")
    ]
    
    for file_path, display_name in files_to_export:
        export_file_content(file_path, display_name, output_file)
    
    # Show summary
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            line_count = len(f.readlines())
        
        print(f"\nExport complete! Output saved to: {output_file}")
        print(f"Total lines: {line_count}")
    else:
        print("\nNo files were exported.")

if __name__ == "__main__":
    main()
