import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const StudentOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    learningStyle: "",
    motivation: "",
    challenges: "",
    interests: ""
  });

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Create student profile
      const { error: profileError } = await supabase.from('student_profiles').insert({
        user_id: user.id,
        preferences_quiz: preferences,
        mentor_tone_ref: "supportive"
      });

      if (profileError) throw profileError;

      // Create initial 5D snapshot
      const { error: snapshotError } = await supabase.from('five_d_snapshots').insert({
        user_id: user.id,
        source: 'onboarding',
        scores: {
          cognitive: 2.5,
          emotional: 2.5,
          social: 2.5,
          creative: 2.5,
          behavioral: 2.5
        }
      });

      if (snapshotError) throw snapshotError;

      toast.success("Profile created successfully!");
      navigate('/student/dashboard');
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
          <CardTitle>Welcome, Student!</CardTitle>
          <CardDescription>Let's learn about your learning preferences (Step {step} of 4)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <Label>How do you learn best?</Label>
              <RadioGroup value={preferences.learningStyle} onValueChange={(v) => setPreferences({ ...preferences, learningStyle: v })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="visual" id="visual" />
                  <Label htmlFor="visual">Visual (pictures, diagrams)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auditory" id="auditory" />
                  <Label htmlFor="auditory">Auditory (listening, discussion)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="kinesthetic" id="kinesthetic" />
                  <Label htmlFor="kinesthetic">Kinesthetic (hands-on, practice)</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label>What motivates you most?</Label>
              <RadioGroup value={preferences.motivation} onValueChange={(v) => setPreferences({ ...preferences, motivation: v })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="achievement" id="achievement" />
                  <Label htmlFor="achievement">Achieving goals and getting good grades</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="curiosity" id="curiosity" />
                  <Label htmlFor="curiosity">Learning new things out of curiosity</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="collaboration" id="collaboration" />
                  <Label htmlFor="collaboration">Working with others and helping classmates</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label>What's your biggest learning challenge?</Label>
              <RadioGroup value={preferences.challenges} onValueChange={(v) => setPreferences({ ...preferences, challenges: v })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="focus" id="focus" />
                  <Label htmlFor="focus">Staying focused and avoiding distractions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="understanding" id="understanding" />
                  <Label htmlFor="understanding">Understanding complex concepts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="organization" id="organization" />
                  <Label htmlFor="organization">Staying organized and managing time</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Label>What are you most interested in?</Label>
              <RadioGroup value={preferences.interests} onValueChange={(v) => setPreferences({ ...preferences, interests: v })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="stem" id="stem" />
                  <Label htmlFor="stem">Science, Technology, Engineering, Math</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="arts" id="arts" />
                  <Label htmlFor="arts">Arts, Music, Creative Writing</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="social" id="social" />
                  <Label htmlFor="social">History, Social Studies, Languages</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex gap-4">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1" disabled={!Object.values(preferences)[step - 1]}>
                Next
              </Button>
            ) : (
              <Button onClick={handleComplete} className="flex-1" disabled={loading || !preferences.interests}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Setup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentOnboarding;