#!/usr/bin/env python3
"""
Script to apply RTL fixes to React components.
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
    # Find the useTranslation import line
    pattern = r"(import \{ useTranslation \} from 'react-i18next';)\n"
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
    # Find the useTranslation hook usage
    pattern = r"(const \{ t \} = useTranslation\(\);)\n"
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
    
    # Pattern to match Input components without dir attribute
    # Matches <Input ... /> where there's no dir attribute already
    def add_dir_to_component(match):
        nonlocal count
        component = match.group(0)
        
        # Skip if already has dir attribute
        if 'dir=' in component:
            return component
        
        # Find the closing /> or >
        if component.rstrip().endswith('/>'):
            # Self-closing tag
            modified = component.rstrip()[:-2] + '\n              dir={isRTL ? \'rtl\' : \'ltr\'}\n            />'
        elif component.rstrip().endswith('>'):
            # Opening tag
            modified = component.rstrip()[:-1] + '\n              dir={isRTL ? \'rtl\' : \'ltr\'}\n            >'
        else:
            return component
        
        count += 1
        return modified
    
    # Match Input components
    pattern_input = r'<Input\n(?:.*?\n)*?.*?(?:/>|>)'
    content = re.sub(pattern_input, add_dir_to_component, content, flags=re.MULTILINE)
    
    # Match Textarea components
    pattern_textarea = r'<Textarea\n(?:.*?\n)*?.*?(?:/>|>)'
    content = re.sub(pattern_textarea, add_dir_to_component, content, flags=re.MULTILINE)
    
    print(f"  ✓ Added dir attribute to {count} Input/Textarea components")
    
    return content

def apply_rtl_fix(filepath):
    """Apply RTL fix to a single file."""
    print(f"\n📝 Processing: {filepath}")
    
    # Read the file
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ✗ Error reading file: {e}")
        return False
    
    # Create backup
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
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✅ Successfully applied RTL fixes")
            return True
        except Exception as e:
            print(f"  ✗ Error writing file: {e}")
            # Restore from backup
            shutil.copy2(f"{filepath}.backup", filepath)
            return False
    else:
        print(f"  ℹ No changes needed")
        return True

def main():
    """Main function to apply RTL fixes to all target files."""
    print("=" * 60)
    print("RTL Fix Application Script")
    print("=" * 60)
    
    base_path = Path(__file__).parent
    
    files_to_fix = [
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
    print("\n💡 Tip: Backup files created with .backup extension")
    print("   If anything goes wrong, you can restore from backups")

if __name__ == "__main__":
    main()
