#!/usr/bin/env python3
"""
RTL Fix Script v3 - Manual line-by-line approach for Auth.tsx
Safer implementation that won't corrupt JSX structure.
"""

import re
from pathlib import Path

def apply_rtl_to_auth():
    """Apply RTL fix to Auth.tsx only."""
    filepath = Path(__file__).parent / "src/pages/Auth.tsx"
    
    print(f"Processing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Track changes
    changes = []
    
    # Step 1: Add import after useTranslation import
    for i, line in enumerate(lines):
        if "import { useTranslation } from 'react-i18next';" in line:
            # Check if useLanguage import already exists
            has_import = any("import { useLanguage }" in l for l in lines)
            if not has_import:
                lines.insert(i + 1, "import { useLanguage } from '@/contexts/LanguageContext';\n")
                changes.append("Added useLanguage import")
                break
    
    # Step 2: Add hook after useTranslation hook
    for i, line in enumerate(lines):
        if "const { t } = useTranslation();" in line:
            # Check if hook already exists
            has_hook = any("const { isRTL } = useLanguage();" in l for l in lines)
            if not has_hook:
                lines.insert(i + 1, "  const { isRTL } = useLanguage();\n")
                changes.append("Added useLanguage hook")
                break
    
    # Step 3: Add dir attribute to Input components (manual positions)
    # We'll add the attribute right before the className prop
    input_positions = [
        # Sign in email input (around line 357-368)
        ("signin-email", 357, 368),
        # Sign in password input (around line 372-383)
        ("signin-password", 372, 383),
        # Sign up email input (around line 470-481)
        ("signup-email", 470, 481),
        # Sign up password input (around line 485-496)
        ("signup-password", 485, 496),
    ]
    
    for input_id, start, end in input_positions:
        # Find the Input component with this id
        for i in range(start, min(end, len(lines))):
            if f'id="{input_id}"' in lines[i]:
                # Find the className line within the next 15 lines
                for j in range(i, min(i + 15, len(lines))):
                    if 'className=' in lines[j] and 'h-12 rounded-2xl' in lines[j]:
                        # Check if dir attribute already exists nearby
                        has_dir = any('dir={isRTL' in lines[k] for k in range(i, j + 1))
                        if not has_dir:
                            # Get indentation from className line
                            indent = len(lines[j]) - len(lines[j].lstrip())
                            # Insert dir attribute before className
                            dir_line = ' ' * indent + 'dir={isRTL ? \'rtl\' : \'ltr\'}\n'
                            lines.insert(j, dir_line)
                            changes.append(f"Added dir to {input_id}")
                        break
                break
    
    # Write back
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.writelines(lines)
    
    print("Changes made:")
    for change in changes:
        print(f"  ✓ {change}")
    print(f"✅ Successfully updated Auth.tsx")

if __name__ == "__main__":
    apply_rtl_to_auth()
