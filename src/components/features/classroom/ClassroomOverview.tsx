/**
 * Classroom Overview Component
 * Display classroom information and invite code
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Calendar, Edit } from 'lucide-react';
import type { Classroom } from '@/types';

interface ClassroomOverviewProps {
  classroom: Classroom;
  onEdit: () => void;
}

/**
 * Display classroom overview with invite code and course information
 */
export const ClassroomOverview = ({ classroom, onEdit }: ClassroomOverviewProps) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl md:text-2xl font-bold">Classroom Overview</h2>
        <Button onClick={onEdit} size="sm" className="w-full sm:w-auto">
          <Edit className="mr-2 h-4 w-4" />
          Edit Information
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Code</CardTitle>
          <CardDescription>Share this code with students to join the classroom</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-mono font-bold px-4 py-2 bg-muted rounded-lg">
              {classroom.invite_code}
            </code>
          </div>
        </CardContent>
      </Card>

      {classroom.course_title && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Course Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Course Title</h3>
              <p className="text-muted-foreground">{classroom.course_title}</p>
            </div>

            {classroom.course_duration && (
              <div>
                <h3 className="font-semibold mb-1">Duration</h3>
                <p className="text-muted-foreground">{classroom.course_duration}</p>
              </div>
            )}

            {(classroom.start_date || classroom.end_date) && (
              <div>
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Course Dates
                </h3>
                <div className="text-muted-foreground">
                  {classroom.start_date && (
                    <p>Start: {new Date(classroom.start_date).toLocaleDateString()}</p>
                  )}
                  {classroom.end_date && (
                    <p>End: {new Date(classroom.end_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            )}

            {classroom.course_outline && (
              <div>
                <h3 className="font-semibold mb-1">Course Outline</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {classroom.course_outline}
                </p>
              </div>
            )}

            {classroom.resources && (
              <div>
                <h3 className="font-semibold mb-1">Resources</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{classroom.resources}</p>
              </div>
            )}

            {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Learning Outcomes</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {classroom.learning_outcomes.map((outcome: string, index: number) => (
                    <li key={index}>{outcome}</li>
                  ))}
                </ul>
              </div>
            )}

            {classroom.key_challenges && classroom.key_challenges.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Key Challenges</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {classroom.key_challenges.map((challenge: string, index: number) => (
                    <li key={index}>{challenge}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

