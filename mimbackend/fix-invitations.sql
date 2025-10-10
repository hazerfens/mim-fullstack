-- Fix hatalı ID'li davetleri temizle
-- ID'si null UUID olan kayıtları sil
DELETE FROM company_invitations 
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Alternatif: Soft delete kullanarak
UPDATE company_invitations 
SET deleted_at = NOW(), 
    status = 'expired' 
WHERE id = '00000000-0000-0000-0000-000000000000' 
  AND deleted_at IS NULL;

-- Tüm pending invitations'ı göster
SELECT 
    id,
    company_id,
    email,
    role_name,
    invited_by,
    status,
    expires_at,
    created_at
FROM company_invitations 
WHERE status = 'pending' 
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Inviter bilgisi ile birlikte göster
SELECT 
    ci.id,
    ci.email as invitation_email,
    ci.role_name,
    ci.status,
    ci.expires_at,
    u.email as inviter_email,
    u.full_name as inviter_name
FROM company_invitations ci
LEFT JOIN users u ON ci.invited_by = u.id
WHERE ci.status = 'pending' 
  AND ci.deleted_at IS NULL
ORDER BY ci.created_at DESC;
