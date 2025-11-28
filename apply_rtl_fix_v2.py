#!/usr/bin/env python3
"""
RTL Fix Script v2 - Improved version with better JSX handling.
Adds useLanguage import, hook, and dir attributes to Input/Textarea components.
"""

import re
import shutil
from pathlib import Path

def backup_file(filepath):
    """Create a backup of the file before modifying."""
    backup_path = f"{filepath}.backup"
    shutil.copy2(filepath, backup_path)
    print(f"✓ Created backup: {backup_path}")
    return backup_path

def add_import(content):
    """Add useLanguage import after useTranslation import."""
    pattern = r"(import \{ useTranslation \} from 'react-i18next';)\r?\n"
    replacement = r"\1\nimport { useLanguage } from '@/contexts/LanguageContext';\n"
    
    if "useLanguage" in content:
        print("  ⚠ useLanguage import already exists")
        return content
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        print("  ✓ Added useLanguage import")
    else:
        print("  ⚠ Could not find useTranslation import")
    
    return content

def add_hook(content):
    """Add const { isRTL } = useLanguage(); after useTranslation hook."""
    pattern = r"(const \{ t \} = useTranslation\(\);)\r?\n"
    replacement = r"\1\n  const { isRTL } = useLanguage();\n"
    
    if "isRTL" in content and "useLanguage()" in content:
        print("  ⚠ useLanguage hook already exists")
        return content
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        print("  ✓ Added useLanguage hook")
    else:
        print("  ⚠ Could not find useTranslation hook")
    
    return content

def add_dir_to_inputs(content):
    """Add dir={isRTL ? 'rtl' : 'ltr'} to Input and Textarea components."""
    count = 0
    lines = content.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        result.append(line)
        
        # Check if this line starts an Input or Textarea component
        if line.strip().startswith('<Input') or line.strip().startswith('<Textarea'):
            # Skip if already has dir attribute
            has_dir = False
            j = i
            # Look ahead to find the closing /> or >
            while j < len(lines):
                if 'dir=' in lines[j]:
                    has_dir = True
                    break
                if '/>' in lines[j] or (lines[j].strip().endswith('>') and not lines[j].strip().endswith('/>'))        :
                    break
                j += 1
            
            if not has_dir and j < len(lines):
                # Find where to insert the dir attribute (just before closing)
                closing_line_idx = j
                closing_line = lines[closing_line_idx]
                
                # Determine indentation from the previous line
                indent = ''
                for char in lines[closing_line_idx]:
                    if char in [' ', '\t']:
                        indent += char
                    else:
                        break
                
                # Insert the dir attribute
                dir_line = f"{indent}  dir={{isRTL ? 'rtl' : 'ltr'}}"
                
                # Add all lines between current and closing
                for k in range(i + 1, closing_line_idx):
                    result.append(lines[k])
                
                # Add the dir attribute
                result.append(dir_line)
                
                # Add the closing line
                result.append(closing_line)
                
                count += 1
                i = closing_line_idx + 1
                continue
        
        i += 1
    
    print(f"  ✓ Added dir attribute to {count} Input/Textarea components")
    
    return '\n'.join(result)

def apply_rtl_fix(filepath):
    """Apply RTL fix to a single file."""
    print(f"\n📝 Processing: {filepath}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ✗ Error reading file: {e}")
        return False
    
    try:
        backup_file(filepath)
    except Exception as e:
        print(f"  ✗ Error creating backup: {e}")
        return False
    
    # Apply fixes
    original_content = content
    content = add_import(content)
    content = add_hook(content)
    content = add_dir_to_inputs(content)
    
    # Write back if changed
    if content != original_content:
        try:
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                f.write(content)
            print(f"  ✅ Successfully applied RTL fixes")
            return True
        except Exception as e:
            print(f"  ✗ Error writing file: {e}")
            shutil.copy2(f"{filepath}.backup", filepath)
            return False
    else:
        print(f"  ℹ No changes needed")
        return True

def main():
    """Main function."""
    print("=" * 60)
    print("RTL Fix Application Script v2")
    print("=" * 60)
    
    base_path = Path(__file__).parent
    
    files_to_fix = [
        base_path / "src/pages/Auth.tsx",
        base_path / "src/pages/onboarding/StudentOnboarding.tsx",
        base_path / "src/pages/onboarding/TeacherOnboarding.tsx",
        base_path / "src/components/CreateAssignmentDialog.tsx",
    ]
    
    success_count = 0
    for filepath in files_to_fix:
        if filepath.exists():
            if apply_rtl_fix(filepath):
                success_count += 1
        else:
            print(f"\n⚠ File not found: {filepath}")
    
    print("\n" + "=" * 60)
    print(f"✅ Successfully processed {success_count}/{len(files_to_fix)} files")
    print("=" * 60)
    print("\n💡 Backups created with .backup extension")

if __name__ == "__main__":
    main()
