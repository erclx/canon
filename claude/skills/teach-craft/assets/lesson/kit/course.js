// The sample course map. A real course keeps its own course.js outside the kit folder, so a newer kit replaces cleanly.
window.course = {
  title: 'Sample course',
  due: 'Review due date',
  lessons: [
    {
      title: 'Lesson title',
      steps: [{ title: 'Lesson', href: 'lesson.html' }],
    },
    { title: 'Lesson not built' },
    { title: 'Another lesson not built' },
  ],
}
