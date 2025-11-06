import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  onSuccess: () => void;
}

export function CreateAssignmentDialog({ open, onOpenChange, classroomId, onSuccess }: CreateAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    instructions: "",
    type: "text_essay",
    due_at: "",
    status: "draft",
    target_dimensions: {
      cognitive: false,
      emotional: false,
      social: false,
      creative: false,
      behavioral: false,
    },
    personalization_flag: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('assignments')
        .insert([{
          classroom_id: classroomId,
          title: formData.title,
          instructions: formData.instructions,
          type: formData.type as any,
          due_at: formData.due_at || null,
          status: formData.status as any,
          target_dimensions: formData.target_dimensions as any,
          personalization_flag: formData.personalization_flag,
        }]);

      if (error) throw error;

      toast.success("Assignment created successfully!");
      onSuccess();
      onOpenChange(false);
      setFormData({
        title: "",
        instructions: "",
        type: "text_essay",
        due_at: "",
        status: "draft",
        target_dimensions: {
          cognitive: false,
          emotional: false,
          social: false,
          creative: false,
          behavioral: false,
        },
        personalization_flag: false,
      });
    } catch (error: any) {
      toast.error("Error creating assignment");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>Design a new assignment for your students</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Assignment Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions *</Label>
            <Textarea
              id="instructions"
              required
              rows={5}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Assignment Type *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_essay">Text Essay</SelectItem>
                  <SelectItem value="file_upload">File Upload</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_at">Due Date</Label>
              <Input
                id="due_at"
                type="datetime-local"
                value={formData.due_at}
                onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Target Learning Dimensions</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(formData.target_dimensions).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        target_dimensions: { ...formData.target_dimensions, [key]: checked as boolean },
                      })
                    }
                  />
                  <label htmlFor={key} className="text-sm font-medium capitalize cursor-pointer">
                    {key}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="personalization"
              checked={formData.personalization_flag}
              onCheckedChange={(checked) => setFormData({ ...formData, personalization_flag: checked as boolean })}
            />
            <label htmlFor="personalization" className="text-sm font-medium cursor-pointer">
              Enable AI Personalization
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Assignment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
