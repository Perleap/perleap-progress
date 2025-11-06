import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const TeacherOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subjects: "",
    yearsExperience: "",
    studentTypes: "",
    teachingGoals: "",
    styleNotes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('teacher_profiles').insert({
        user_id: user.id,
        subjects: formData.subjects.split(',').map(s => s.trim()),
        years_experience: parseInt(formData.yearsExperience) || 0,
        student_types: formData.studentTypes,
        teaching_goals: formData.teachingGoals,
        style_notes: formData.styleNotes
      });

      if (error) throw error;

      toast.success("Profile created successfully!");
      navigate('/teacher/dashboard');
    } catch (error: any) {
      toast.error(error.message || "Error creating profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome, Teacher!</CardTitle>
          <CardDescription>Tell us about your teaching practice</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subjects">Subjects (comma-separated)</Label>
              <Input
                id="subjects"
                placeholder="Math, Science, English"
                value={formData.subjects}
                onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                type="number"
                placeholder="5"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentTypes">Types of Students</Label>
              <Input
                id="studentTypes"
                placeholder="Middle school, High school, etc."
                value={formData.studentTypes}
                onChange={(e) => setFormData({ ...formData, studentTypes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goals">Teaching Goals</Label>
              <Textarea
                id="goals"
                placeholder="What are your main teaching objectives?"
                value={formData.teachingGoals}
                onChange={(e) => setFormData({ ...formData, teachingGoals: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="style">Teaching Style Notes</Label>
              <Textarea
                id="style"
                placeholder="Describe your teaching approach..."
                value={formData.styleNotes}
                onChange={(e) => setFormData({ ...formData, styleNotes: e.target.value })}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Setup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherOnboarding;