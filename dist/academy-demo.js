/* Recording scenario only; all outcomes are calculated by Academy. */
window.AcademyDemo = {
  id: 'technician', version: 1, roleId: 'technician',
  chapters: [
    { die: 3, event: 'technician-review' },
    { die: 2, event: 'technician-disability' },
    { die: 2, event: 'technician-outpatient' },
    { die: 1, event: 'technician-layoff' },
    { die: 4, event: 'technician-raise' },
    { die: 1, event: 'technician-hospital' }
  ]
};
