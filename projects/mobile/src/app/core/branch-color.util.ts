/** Maps a branch id to a CSS modifier class so cards on Home/Events/Courses read as
 * distinct branches at a glance, without relying on reading the branch name text.
 * Unrecognized branches (e.g. a newly added one) fall back to the original neutral style. */
const BRANCH_CLASS_BY_ID: Record<string, string> = {
  '3b5ce344-830d-4f03-a564-b89f6e290033': 'branch-us',
  '6259f790-27f0-4668-896f-ec038662b172': 'branch-ca',
  'd4d0febb-7d2e-4c43-a652-0c60d7338b2d': 'branch-au',
};

export function branchColorClass(branchId: string | null | undefined): string {
  return (branchId && BRANCH_CLASS_BY_ID[branchId]) || 'branch-other';
}
