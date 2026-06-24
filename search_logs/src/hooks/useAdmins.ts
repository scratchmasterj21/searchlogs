import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';
import { FALLBACK_ADMIN_EMAILS, isAdminEmail } from '../constants';

// Reads the live admin allowlist from `config/admins` in the gfa-typing RTDB, falling back
// to the hardcoded FALLBACK_ADMIN_EMAILS if the node is missing/unreadable. Returns the
// lowercased list plus a convenience `isAdmin(email)` checker.
export function useAdmins(): { admins: string[]; isAdmin: (email: string | null | undefined) => boolean } {
  const [admins, setAdmins] = useState<string[]>(FALLBACK_ADMIN_EMAILS);

  useEffect(() => {
    const adminsRef = ref(database, 'config/admins');
    const unsubscribe = onValue(
      adminsRef,
      snapshot => {
        const val = snapshot.val();
        if (Array.isArray(val) && val.length > 0) {
          setAdmins(val.map((e: unknown) => String(e).toLowerCase()).filter(Boolean));
        } else if (val && typeof val === 'object') {
          // Tolerate object-keyed lists ({0: "a@x", 1: "b@y"}).
          const list = Object.values(val).map(e => String(e).toLowerCase()).filter(Boolean);
          setAdmins(list.length > 0 ? list : FALLBACK_ADMIN_EMAILS);
        } else {
          setAdmins(FALLBACK_ADMIN_EMAILS);
        }
      },
      () => setAdmins(FALLBACK_ADMIN_EMAILS)
    );
    return () => unsubscribe();
  }, []);

  return { admins, isAdmin: (email) => isAdminEmail(email, admins) };
}
