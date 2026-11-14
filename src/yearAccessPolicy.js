/**
 * ГРОТ 2.0 — единая политика доступа к графикам по годам.
 *
 * Год сам по себе НЕ определяет режим формы и право исправления.
 * Архивные записи не изменяются без явного разрешения на корректировку.
 * Эта функция не сохраняет данные и не меняет действующие версии ГРОТ.
 */
export function yearAccessPolicy({
  year,
  calendarYear,
  role = 'observer',
  status = 'draft',
  localNetwork = false,
  correctionMode = false
} = {}) {
  const y = Number(year);
  const now = Number(calendarYear);
  if (!Number.isInteger(y) || y < 2000 || y > 2200 ||
      !Number.isInteger(now) || now < 2000 || now > 2200) {
    throw new RangeError('Неизвестный год графика');
  }
  const normalizedRole = String(role).toLowerCase();
  const normalizedStatus = String(status).toLowerCase();
  const isAdmin = normalizedRole === 'administrator' || normalizedRole === 'admin';
  const isManager = normalizedRole === 'manager' || normalizedRole === 'approver';
  const canEdit = isAdmin || isManager;
  const isApproved = normalizedStatus === 'approved';
  const isArchived = normalizedStatus === 'archived';
  const isPast = y < now;
  const needsCorrection = isApproved || isArchived || isPast;
  const canEditPlan = canEdit && !needsCorrection;
  const canCorrect = canEdit && correctionMode && needsCorrection;
  const canApprove = isManager && localNetwork && !isApproved && !isArchived;
  return {
    year: y,
    view: true,
    form: 'unified',
    readOnly: !(canEditPlan || canCorrect),
    canEditPlan,
    canCorrect,
    canApprove,
    needsCorrection,
    status: normalizedStatus
  };
}
