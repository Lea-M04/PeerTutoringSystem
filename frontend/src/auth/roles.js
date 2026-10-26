export function isAdminUser(user) {
  return Boolean(user?.roles?.includes('admin'));
}

export function isStudentUser(user) {
  return Boolean(user?.roles?.includes('student') && !isAdminUser(user));
}

export function isApprovedTutor(user) {
  return Boolean(user?.is_approved_tutor === true && !isAdminUser(user));
}
