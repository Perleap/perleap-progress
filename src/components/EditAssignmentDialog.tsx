import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createBulkNotifications } from "@/lib/notificationService";

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string | null;
  classroom_id?: string;
}

interface EditAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  onSuccess: () => void;
}

export function EditAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSuccess,
}: EditAssignmentDialogProps) {
  const [title, setTitle] = useState(assignment.title);
  const [instructions, setInstructions] = useState(assignment.instructions);
  const [type, setType] = useState(assignment.type);
  const [status, setStatus] = useState(assignment.status);
  const [dueDate, setDueDate] = useState(
    assignment.due_at ? new Date(assignment.due_at).toISOString().slice(0, 16) : ""
  );
  const [loading, setLoading] = useState(false);

  // Update state when assignment changes
  useEffect(() => {
    setTitle(assignment.title);
    setInstructions(assignment.instructions);
    setType(assignment.type);
    setStatus(assignment.status);
    setDueDate(assignment.due_at ? new Date(assignment.due_at).toISOString().slice(0, 16) : "");
  }, [assignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if status is changing from draft to published
      const wasPublished = assignment.status === 'draft' && status === 'published';

      const { error } = await supabase
        .from("assignments")
        .update({
          title,
          instructions,
          type: type as any,
          status: status as any,
          due_at: dueDate || null,
        })
        .eq("id", assignment.id);

      if (error) throw error;

      // If assignment was just published, notify all enrolled students
      if (wasPublished) {
        try {
          // Get classroom_id if not already provided
          let classroomId = assignment.classroom_id;
          if (!classroomId) {
            const { data: assignmentData } = await supabase
              .from('assignments')
              .select('classroom_id')
              .eq('id', assignment.id)
              .single();
            classroomId = assignmentData?.classroom_id;
          }

          if (classroomId) {
            // Fetch all students enrolled in this classroom
            const { data: enrollments, error: enrollError } = await supabase
              .from('enrollments')
              .select('student_id')
              .eq('classroom_id', classroomId);

            if (!enrollError && enrollments && enrollments.length > 0) {
              // Create notifications for all enrolled students
              const notifications = enrollments.map(enrollment => ({
                userId: enrollment.student_id,
                type: 'assignment_created' as const,
                title: 'New Assignment Posted',
                message: `${title} has been assigned`,
                link: `/student/assignment/${assignment.id}`,
                metadata: {
                  assignment_id: assignment.id,
                  classroom_id: classroomId,
                  assignment_title: title,
                  due_at: dueDate || null,
                },
              }));

              await createBulkNotifications(notifications);
            }
          }
        } catch (notifError) {
          // Don't fail the assignment update if notifications fail
        }
      }

      toast.success("Assignment updated successfully");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to update assignment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>
            Update assignment details and publish status
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Assignment Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Essay on Photosynthesis"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Provide detailed instructions for the assignment..."
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Assignment Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_essay">Text Essay</SelectItem>
                  <SelectItem value="interactive">Interactive</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
