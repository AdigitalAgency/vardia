-- Vardia — στοιχεία μισθοδοσίας εργαζομένου
-- Το αρχείο του λογιστή θέλει ΕΠΩΝΥΜΟ και ΟΝΟΜΑ σε ξεχωριστές στήλες
-- (LITTLEMOSQUE_BRAIN §5α). Το full_name μένει για εμφάνιση στο πρόγραμμα,
-- όπου ο owner γράφει ό,τι λέει και το χαρτί (συνήθως μόνο επώνυμο).

alter table employees add column if not exists first_name text;
alter table employees add column if not exists last_name text;

comment on column employees.full_name is 'Εμφάνιση στο grid — ό,τι γράφει ο owner';
comment on column employees.last_name is 'ΕΠΩΝΥΜΟ στο export του λογιστή';
comment on column employees.first_name is 'ΟΝΟΜΑ στο export του λογιστή';
comment on column employees.afm is 'Α.Φ.Μ — στήλη export';
comment on column employees.payroll_id is 'ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ στο σύστημα μισθοδοσίας';

-- Ο λογιστής πρέπει να μπορεί να συμπληρώνει ΤΑ ΔΙΚΑ ΤΟΥ πεδία χωρίς να αγγίζει
-- το πρόγραμμα: το employees_admin_all τον καλύπτει ήδη (owner|manager|accountant).
