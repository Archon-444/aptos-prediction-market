#!/bin/bash
# Fix all process.env references to import.meta.env

echo "Fixing environment variable references..."

# Fix useNotifications.ts
sed -i '' 's/process\.env\.REACT_APP_VAPID_PUBLIC_KEY/import.meta.env.VITE_VAPID_PUBLIC_KEY/g' src/hooks/useNotifications.ts
sed -i '' 's/process\.env\.REACT_APP_API_URL/import.meta.env.VITE_API_URL/g' src/hooks/useNotifications.ts

# Fix pushNotifications.ts
sed -i '' 's/process\.env\.REACT_APP_VAPID_PUBLIC_KEY/import.meta.env.VITE_VAPID_PUBLIC_KEY/g' src/utils/pushNotifications.ts || true
sed -i '' 's/process\.env\.REACT_APP_API_URL/import.meta.env.VITE_API_URL/g' src/utils/pushNotifications.ts || true

# Fix biometricAuth.ts
sed -i '' 's/process\.env\.REACT_APP/import.meta.env.VITE/g' src/utils/biometricAuth.ts || true

# Fix MarketList.tsx
sed -i '' 's/process\.env\.REACT_APP/import.meta.env.VITE/g' src/components/MarketList.tsx || true

echo "Done! Environment variables fixed."
