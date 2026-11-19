-- Internal catalogue trigger helpers must not be directly executable by API roles.
revoke execute on function private.product_variant_guard() from public,anon,authenticated;
revoke execute on function private.product_variant_inventory_audit() from public,anon,authenticated;
revoke execute on function private.product_stock_inventory_audit() from public,anon,authenticated;
revoke execute on function private.validate_product_category_attributes() from public,anon,authenticated;
revoke execute on function private.collections_taxonomy_guard() from public,anon,authenticated;
