#!/usr/bin/env python3
"""
Script to fix usdc_integration_tests.move (renamed from integration_tests) with dual-signer pattern.
"""

import re

def fix_usdc_integration_tests():
    # The module is called integration_tests, but the file is usdc_integration_tests.move
    filepath = 'usdc_integration_tests.move'

    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Fix setup_test function signature
    old_setup_sig = '''    fun setup_test(
        aptos_framework: &signer,
        admin: &signer,
    ): address {'''

    new_setup_sig = '''    fun setup_test(
        aptos_framework: &signer,
        usdc_admin: &signer,
        pm_admin: &signer,
    ): address {'''

    content = content.replace(old_setup_sig, new_setup_sig)

    # 2. Fix setup_test function body - need to handle the actual structure
    # The pattern in this file has:
    # timestamp, account creation, let admin_addr, account creation again, then initializations

    # Replace the variable declaration and account creation
    content = re.sub(
        r'let admin_addr = signer::address_of\(admin\);\s*account::create_account_for_test\(admin_addr\);',
        'account::create_account_for_test(@0xcafe);\n        account::create_account_for_test(@prediction_market);',
        content
    )

    # Replace initialization calls
    content = content.replace('usdc::initialize(admin);', 'usdc::initialize(usdc_admin);')
    content = content.replace('market_manager::initialize(admin);', 'market_manager::initialize(pm_admin);')
    content = content.replace('collateral_vault::initialize(admin);', 'collateral_vault::initialize(pm_admin);')
    content = re.sub(
        r'betting::initialize\(admin, admin_addr\);',
        'betting::initialize(pm_admin, @prediction_market);',
        content
    )

    # Fix return value
    content = re.sub(
        r'(\s+commit_reveal::initialize\(.*?\);)\s*admin_addr',
        r'\1\n\n        @prediction_market',
        content
    )

    # 3. Fix mint_usdc_to_user signature and body
    content = content.replace(
        'fun mint_usdc_to_user(admin: &signer, user: &signer, amount: u64)',
        'fun mint_usdc_to_user(usdc_admin: &signer, user: &signer, amount: u64)'
    )
    content = re.sub(
        r'usdc::mint\(admin, user_addr, amount\);',
        r'usdc::mint(usdc_admin, user_addr, amount);',
        content
    )

    # 4. Fix all test signatures
    content = re.sub(
        r'#\[test\(aptos_framework = @0x1, admin = @0xcafe,',
        r'#[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market,',
        content
    )

    # 5. Fix test function parameter lists
    content = re.sub(
        r'(\s+aptos_framework: &signer,)\s*\n\s*admin: &signer,',
        r'\1\n        usdc_admin: &signer,\n        pm_admin: &signer,',
        content
    )

    # 6. Fix setup_test calls
    content = content.replace(
        'let admin_addr = setup_test(aptos_framework, admin);',
        'let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);'
    )
    content = content.replace(
        'setup_test(aptos_framework, admin);',
        'setup_test(aptos_framework, usdc_admin, pm_admin);'
    )

    # 7. Fix references to admin_addr
    content = content.replace('admin_addr', 'pm_admin_addr')

    # 8. Fix mint_usdc_to_user calls
    content = re.sub(
        r'mint_usdc_to_user\(admin,',
        r'mint_usdc_to_user(usdc_admin,',
        content
    )

    # 9. Fix market_manager operations
    content = re.sub(
        r'market_manager::create_market\(\s*admin,',
        r'market_manager::create_market(\n            pm_admin,',
        content
    )
    content = re.sub(
        r'market_manager::resolve_market\(admin,',
        r'market_manager::resolve_market(pm_admin,',
        content
    )

    # 10. Fix betting operations
    content = re.sub(
        r'betting::unlock_market_collateral\(admin,',
        r'betting::unlock_market_collateral(pm_admin,',
        content
    )

    # 11. Fix usdc faucet calls (special case in this file)
    content = re.sub(
        r'usdc::faucet\((\w+), signer::address_of\(admin\)\)',
        r'usdc::faucet(\1, @0xcafe)',
        content
    )

    # Write the fixed content
    with open(filepath, 'w') as f:
        f.write(content)

    print(f"✓ Fixed {filepath}")

if __name__ == '__main__':
    fix_usdc_integration_tests()
