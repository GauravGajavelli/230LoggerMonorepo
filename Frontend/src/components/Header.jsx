import { BookOpen, Github } from 'lucide-react';

export function Header({ 
  students, 
  assignments, 
  selectedStudent, 
  selectedAssignment,
  onStudentChange,
  onAssignmentChange 
}) {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <BookOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              DSA Debugging Coach
            </h1>
            <p className="text-xs text-slate-400">CSSE 230 • Rose-Hulman</p>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex items-center gap-4">
          {/* Student Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Student:</label>
            <select
              value={selectedStudent}
              onChange={(e) => onStudentChange(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.submissionCount} submissions)
                </option>
              ))}
            </select>
          </div>

          {/* Assignment Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Assignment:</label>
            <select
              value={selectedAssignment}
              onChange={(e) => onAssignmentChange(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {assignments.map(assignment => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Demo Mode
          </span>
        </div>
      </div>
    </header>
  );
}
