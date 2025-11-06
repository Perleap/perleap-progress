import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: any;
  onSuccess: () => void;
}

export function EditClassroomDialog({ open, onOpenChange, classroom, onSuccess }: EditClassroomDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: classroom.name || "",
    subject: classroom.subject || "",
    course_title: classroom.course_title || "",
    course_duration: classroom.course_duration || "",
    start_date: classroom.start_date || "",
    end_date: classroom.end_date || "",
    course_outline: classroom.course_outline || "",
    resources: classroom.resources || "",
    learning_outcomes: Array.isArray(classroom.learning_outcomes) ? classroom.learning_outcomes.join("\n") : "",
    key_challenges: Array.isArray(classroom.key_challenges) ? classroom.key_challenges.join("\n") : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const learningOutcomes = formData.learning_outcomes
        .split("\n")
        .filter(o => o.trim())
        .map(o => o.trim());

      const keyChallenges = formData.key_challenges
        .split("\n")
        .filter(c => c.trim())
        .map(c => c.trim());

      const { error } = await supabase
        .from('classrooms')
        .update({
          name: formData.name,
          subject: formData.subject,
          course_title: formData.course_title,
          course_duration: formData.course_duration,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          course_outline: formData.course_outline,
          resources: formData.resources,
          learning_outcomes: learningOutcomes,
          key_challenges: keyChallenges,
        })
        .eq('id', classroom.id);

      if (error) throw error;

      toast.success("Classroom updated successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Error updating classroom");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Classroom</DialogTitle>
          <DialogDescription>Update your classroom information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Classroom Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_title">Course Title</Label>
            <Input
              id="course_title"
              value={formData.course_title}
              onChange={(e) => setFormData({ ...formData, course_title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_duration">Course Duration</Label>
            <Input
              id="course_duration"
              placeholder="e.g., 8 weeks, 1 semester"
              value={formData.course_duration}
              onChange={(e) => setFormData({ ...formData, course_duration: e.target.value })}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_outline">Course Outline</Label>
            <Textarea
              id="course_outline"
              placeholder="Topics and flow..."
              rows={4}
              value={formData.course_outline}
              onChange={(e) => setFormData({ ...formData, course_outline: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resources">Resources</Label>
            <Textarea
              id="resources"
              placeholder="Books, links, PDFs, tools..."
              rows={3}
              value={formData.resources}
              onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="learning_outcomes">Learning Outcomes (one per line)</Label>
            <Textarea
              id="learning_outcomes"
              placeholder="Outcome 1&#10;Outcome 2&#10;Outcome 3"
              rows={4}
              value={formData.learning_outcomes}
              onChange={(e) => setFormData({ ...formData, learning_outcomes: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="key_challenges">Key Challenges (one per line)</Label>
            <Textarea
              id="key_challenges"
              placeholder="Challenge 1&#10;Challenge 2"
              rows={3}
              value={formData.key_challenges}
              onChange={(e) => setFormData({ ...formData, key_challenges: e.target.value })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
