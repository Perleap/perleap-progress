import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";

const StudentOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  const [formData, setFormData] = useState({
    fullName: "",
    learningMethods: "",
    soloVsGroup: "",
    scheduledVsFlexible: "",
    motivationFactors: "",
    helpPreferences: "",
    teacherPreferences: "",
    feedbackPreferences: "",
    learningGoal: "",
    specialNeeds: "",
    additionalNotes: "",
  });

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Create student profile
      const { error: profileError } = await supabase.from('student_profiles').insert({
        user_id: user.id,
        full_name: formData.fullName,
        learning_methods: formData.learningMethods,
        solo_vs_group: formData.soloVsGroup,
        scheduled_vs_flexible: formData.scheduledVsFlexible,
        motivation_factors: formData.motivationFactors,
        help_preferences: formData.helpPreferences,
        teacher_preferences: formData.teacherPreferences,
        feedback_preferences: formData.feedbackPreferences,
        learning_goal: formData.learningGoal,
        special_needs: formData.specialNeeds,
        additional_notes: formData.additionalNotes,
        preferences_quiz: {
          learningMethods: formData.learningMethods,
          soloVsGroup: formData.soloVsGroup,
          scheduledVsFlexible: formData.scheduledVsFlexible,
          motivationFactors: formData.motivationFactors,
        },
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

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-4 mt-6">
              <Label>What kinds of activities or methods help you learn best?</Label>
              <RadioGroup value={formData.learningMethods} onValueChange={(v) => setFormData({ ...formData, learningMethods: v })}>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="visual" id="visual" className="mt-1" />
                  <Label htmlFor="visual" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">Visual Learning</span> - I learn best by reading textbooks, looking at diagrams, charts, and pictures
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="auditory" id="auditory" className="mt-1" />
                  <Label htmlFor="auditory" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">Auditory Learning</span> - I learn best by listening to explanations and discussions
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="kinesthetic" id="kinesthetic" className="mt-1" />
                  <Label htmlFor="kinesthetic" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">Kinesthetic Learning</span> - I learn best by doing hands-on practice and activities
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="video" id="video" className="mt-1" />
                  <Label htmlFor="video" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">Video Learning</span> - I learn best by watching videos and demonstrations
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>Do you learn better when you study on your own, or do you prefer learning with others?</Label>
            <RadioGroup value={formData.soloVsGroup} onValueChange={(v) => setFormData({ ...formData, soloVsGroup: v })}>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="solo" id="solo" className="mt-1" />
                <Label htmlFor="solo" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Solo Learning</span> - I prefer working through material on my own
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="group" id="group" className="mt-1" />
                <Label htmlFor="group" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Group Learning</span> - I like group activities and discussions to help me understand
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="both" id="both" className="mt-1" />
                <Label htmlFor="both" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Flexible</span> - I like a mix of both solo and group learning
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-6">
              <Label>Do you like to follow a set study schedule or plan, or do you prefer to be flexible?</Label>
              <RadioGroup value={formData.scheduledVsFlexible} onValueChange={(v) => setFormData({ ...formData, scheduledVsFlexible: v })} className="mt-4">
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="scheduled" id="scheduled" className="mt-1" />
                  <Label htmlFor="scheduled" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">Structured Schedule</span> - I thrive with a set routine and plan
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="flexible" id="flexible" className="mt-1" />
                  <Label htmlFor="flexible" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">Flexible Approach</span> - I prefer to decide what to study as I go
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label>What motivates you to put in your best effort when learning something new?</Label>
            <RadioGroup value={formData.motivationFactors} onValueChange={(v) => setFormData({ ...formData, motivationFactors: v })}>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="curiosity" id="curiosity" className="mt-1" />
                <Label htmlFor="curiosity" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Curiosity</span> - I love learning about new topics that interest me
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="grades" id="grades" className="mt-1" />
                <Label htmlFor="grades" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Achievement</span> - I want to achieve high grades and academic success
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="encouragement" id="encouragement" className="mt-1" />
                <Label htmlFor="encouragement" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Recognition</span> - I'm motivated by praise and encouragement from others
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="personal_goals" id="personal_goals" className="mt-1" />
                <Label htmlFor="personal_goals" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Personal Goals</span> - I'm driven by my own goals and aspirations
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="competition" id="competition" className="mt-1" />
                <Label htmlFor="competition" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">Competition</span> - I'm motivated by friendly competition with peers
                </Label>
              </div>
            </RadioGroup>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Label>If you're struggling to understand a concept or skill, what's the best way someone can help you?</Label>
            <RadioGroup value={formData.helpPreferences} onValueChange={(v) => setFormData({ ...formData, helpPreferences: v })}>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="hints" id="hints" className="mt-1" />
                <Label htmlFor="hints" className="cursor-pointer font-normal leading-relaxed">
                  Give me hints or clues to figure it out myself
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="different_way" id="different_way" className="mt-1" />
                <Label htmlFor="different_way" className="cursor-pointer font-normal leading-relaxed">
                  Explain it in a different way or with different examples
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="step_by_step" id="step_by_step" className="mt-1" />
                <Label htmlFor="step_by_step" className="cursor-pointer font-normal leading-relaxed">
                  Show me a step-by-step solution
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="more_time" id="more_time" className="mt-1" />
                <Label htmlFor="more_time" className="cursor-pointer font-normal leading-relaxed">
                  Let me figure it out on my own with more time
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-6">
              <Label>What do you look for in a teacher or coach?</Label>
              <RadioGroup value={formData.teacherPreferences} onValueChange={(v) => setFormData({ ...formData, teacherPreferences: v })} className="mt-4">
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="patient" id="patient" className="mt-1" />
                  <Label htmlFor="patient" className="cursor-pointer font-normal leading-relaxed">
                    Someone who is patient and understanding
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="challenging" id="challenging" className="mt-1" />
                  <Label htmlFor="challenging" className="cursor-pointer font-normal leading-relaxed">
                    Someone who pushes me to achieve my best
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="clear" id="clear" className="mt-1" />
                  <Label htmlFor="clear" className="cursor-pointer font-normal leading-relaxed">
                    Someone who explains everything very clearly
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="fun" id="fun" className="mt-1" />
                  <Label htmlFor="fun" className="cursor-pointer font-normal leading-relaxed">
                    Someone who makes learning fun and engaging
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <Label>How do you prefer to receive feedback or corrections on your work?</Label>
            <RadioGroup value={formData.feedbackPreferences} onValueChange={(v) => setFormData({ ...formData, feedbackPreferences: v })}>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
                <Label htmlFor="immediate" className="cursor-pointer font-normal leading-relaxed">
                  Immediate feedback as I practice
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="written" id="written" className="mt-1" />
                <Label htmlFor="written" className="cursor-pointer font-normal leading-relaxed">
                  Written comments or scores afterward
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="discussion" id="discussion" className="mt-1" />
                <Label htmlFor="discussion" className="cursor-pointer font-normal leading-relaxed">
                  A quick talk where the teacher goes over how I did
                </Label>
              </div>
            </RadioGroup>

            <div className="space-y-2 mt-6">
              <Label htmlFor="learningGoal">What is one goal you hope to achieve through this learning experience?</Label>
              <Textarea
                id="learningGoal"
                placeholder="e.g., Improve my grade, master a skill, gain confidence, prepare for college..."
                value={formData.learningGoal}
                onChange={(e) => setFormData({ ...formData, learningGoal: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialNeeds">Do you have any specific needs or preferences that help you learn better?</Label>
              <Textarea
                id="specialNeeds"
                placeholder="e.g., Short breaks, visual aids, hands-on practice, quiet environment..."
                value={formData.specialNeeds}
                onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalNotes">Is there anything else you'd like your teacher or the AI to know about how you like to learn or study?</Label>
              <Textarea
                id="additionalNotes"
                placeholder="Share any other comments, learning difficulties, anxieties, or preferences..."
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Student Profile Setup</CardTitle>
          <CardDescription>
            Step {step} of {totalSteps}: Let's learn about your learning preferences
          </CardDescription>
          <div className="w-full bg-secondary rounded-full h-2 mt-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-y-auto px-1">
            {renderStep()}
          </div>

          <div className="flex gap-4 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="flex-1" disabled={loading || !formData.fullName}>
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