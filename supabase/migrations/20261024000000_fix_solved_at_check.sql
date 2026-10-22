-- Fix: the original check `(status = 'completed') = (solved_at is not null)` evaluates to NULL
-- (and therefore passes) when status is NULL, allowing a solve date on an unsolved row.
-- coalesce() makes the comparison strictly boolean.

-- Repair any rows the old check let through
update public.problem_progress
   set solved_at = null
 where status is distinct from 'completed' and solved_at is not null;

alter table public.problem_progress drop constraint solved_at_matches_status;
alter table public.problem_progress add constraint solved_at_matches_status
  check (coalesce(status = 'completed', false) = (solved_at is not null));
