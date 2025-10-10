-- CompanyMember kayıtlarını ve ilişkili User bilgilerini kontrol et
SELECT 
    cm.id as member_id,
    cm.user_id,
    cm.company_id,
    cm.role_id,
    cm.is_owner,
    cm.is_active,
    cm.joined_at,
    u.id as user_exists,
    u.email,
    u.full_name,
    u.email_verified
FROM company_members cm
LEFT JOIN users u ON cm.user_id = u.id
WHERE cm.deleted_at IS NULL
ORDER BY cm.created_at DESC;

-- User bilgisi olmayan (orphan) üyeleri bul
SELECT 
    cm.id,
    cm.user_id,
    cm.company_id,
    cm.is_owner,
    cm.created_at
FROM company_members cm
LEFT JOIN users u ON cm.user_id = u.id
WHERE cm.deleted_at IS NULL 
  AND u.id IS NULL;

-- Tüm company üyelerini say
SELECT 
    c.id as company_id,
    c.name as company_name,
    COUNT(cm.id) as member_count,
    SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as valid_members,
    SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) as orphan_members
FROM companies c
LEFT JOIN company_members cm ON c.id = cm.company_id AND cm.deleted_at IS NULL
LEFT JOIN users u ON cm.user_id = u.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name;

-- Hatalı kayıtları temizle (OPSIYONEL - dikkatli kullanın!)
-- DELETE FROM company_members 
-- WHERE user_id NOT IN (SELECT id FROM users)
--   AND deleted_at IS NULL;

-- Veya soft delete yap
-- UPDATE company_members 
-- SET deleted_at = NOW()
-- WHERE user_id NOT IN (SELECT id FROM users)
--   AND deleted_at IS NULL;
