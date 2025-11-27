#!/usr/bin/env python3
"""
Script to fix comprehensive_integration_tests.move with dual-signer pattern.
This updates tests to use separate signers for USDC (@circle) and market operations (@prediction_market).
"""

import re

def fix_comprehensive_integration_tests():
    filepath = 'comprehensive_integration_tests.move'

    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Remove coin::create_coin_conversion_map line
    content = re.sub(r'\s*coin::create_coin_conversion_map\(aptos_framework\);\n', '', content)

    # 2. Fix setup_test function signature
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

    # 3. Fix setup_test function body
    old_setup_body = '''        timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(@0x1);

        let admin_addr = signer::address_of(admin);

        usdc::initialize(admin);
        market_manager::initialize(admin);
        collateral_vault::initialize(admin);
        betting::initialize(admin, admin_addr);
        commit_reveal::initialize(admin);

        admin_addr'''

    new_setup_body = '''        timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(@0x1);
        account::create_account_for_test(@0xcafe);
        account::create_account_for_test(@prediction_market);

        usdc::initialize(usdc_admin);
        market_manager::initialize(pm_admin);
        collateral_vault::initialize(pm_admin);
        betting::initialize(pm_admin, @prediction_market);
        commit_reveal::initialize(pm_admin);

        @prediction_market'''

    content = content.replace(old_setup_body, new_setup_body)

    # 4. Fix mint_usdc_to_user signature
    content = content.replace(
        'fun mint_usdc_to_user(admin: &signer, user: &signer, amount: u64)',
        'fun mint_usdc_to_user(usdc_admin: &signer, user: &signer, amount: u64)'
    )

    # 5. Fix mint_usdc_to_user body
    content = content.replace(
        '        usdc::register(user);\n        usdc::mint(admin, signer::address_of(user), amount);',
        '        usdc::register(user);\n        usdc::mint(usdc_admin, signer::address_of(user), amount);'
    )

    # 6. Fix all test signatures - add both signers
    content = re.sub(
        r'#\[test\(aptos_framework = @0x1, admin = @0xcafe,',
        r'#[test(aptos_framework = @0x1, usdc_admin = @0xcafe, pm_admin = @prediction_market,',
        content
    )

    # 7. Fix test function parameter lists - replace admin: &signer with two params
    # Match pattern: aptos_framework: &signer,\n        admin: &signer,
    content = re.sub(
        r'(\s+aptos_framework: &signer,)\s*\n\s*admin: &signer,',
        r'\1\n        usdc_admin: &signer,\n        pm_admin: &signer,',
        content
    )

    # 8. Fix setup_test calls
    content = content.replace(
        'setup_test(aptos_framework, admin)',
        'setup_test(aptos_framework, usdc_admin, pm_admin)'
    )

    # 9. Fix admin_addr references - need to get it from pm_admin now
    # First, let's handle the common pattern where admin_addr is retrieved
    content = content.replace(
        'let admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);',
        'let pm_admin_addr = setup_test(aptos_framework, usdc_admin, pm_admin);'
    )

    # Replace admin_addr with pm_admin_addr in function calls
    content = re.sub(
        r'collateral_vault::get_vault_balance\(admin_addr\)',
        r'collateral_vault::get_vault_balance(pm_admin_addr)',
        content
    )
    content = re.sub(
        r'collateral_vault::get_market_stakes\(admin_addr,',
        r'collateral_vault::get_market_stakes(pm_admin_addr,',
        content
    )

    # 10. Fix references to 'admin' in test bodies - replace with pm_admin for market operations
    # This is tricky because we need context. Let's do specific replacements:

    # access_control operations use pm_admin
    content = re.sub(
        r'access_control::is_admin\(signer::address_of\(admin\)\)',
        r'access_control::is_admin(signer::address_of(pm_admin))',
        content
    )
    content = re.sub(
        r'access_control::grant_role\(admin,',
        r'access_control::grant_role(pm_admin,',
        content
    )
    content = re.sub(
        r'access_control::revoke_role\(admin,',
        r'access_control::revoke_role(pm_admin,',
        content
    )
    content = re.sub(
        r'access_control::pause\((\w+)\)',
        r'access_control::pause(\1)',  # Don't change - uses pauser
        content
    )
    content = re.sub(
        r'access_control::unpause\(admin\)',
        r'access_control::unpause(pm_admin)',
        content
    )

    # market_manager operations use pm_admin
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

    # betting operations use pm_admin
    content = re.sub(
        r'betting::unlock_market_collateral\(admin,',
        r'betting::unlock_market_collateral(pm_admin,',
        content
    )

    # mint_usdc_to_user calls use usdc_admin
    content = re.sub(
        r'mint_usdc_to_user\(admin,',
        r'mint_usdc_to_user(usdc_admin,',
        content
    )

    # Write the fixed content
    with open(filepath, 'w') as f:
        f.write(content)

    print(f"✓ Fixed {filepath}")
    print("  - Removed coin::create_coin_conversion_map")
    print("  - Updated setup_test to use dual signers")
    print("  - Fixed all test signatures")
    print("  - Updated all admin references to use correct signer")

if __name__ == '__main__':
    fix_comprehensive_integration_tests()
