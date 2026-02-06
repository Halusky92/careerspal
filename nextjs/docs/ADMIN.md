# Admin access

## Roles

- `admin` is based on email: `admin@careerspal.com`
- other Google users default to `candidate`

## Admin routes

- `/dashboard/admin`

## Notes

- Protects admin pages via `middleware.ts`
- For production, store roles in database instead of localStorage
