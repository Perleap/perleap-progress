 import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowLeft, ArrowRight, Upload } from "lucide-react";

const TeacherOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const [formData, setFormData] = useState({
    // Page 1: Essential Profile
    fullName: "",
    phoneNumber: "",
    subjects: "",
    yearsExperience: "",
    studentEducationLevel: "",
    
    // Page 2: Teaching Voice
    teachingGoals: "",
    teachingStyle: "",
    teachingExample: "",
    additionalNotes: "",
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("User not authenticated. Please sign in again.");
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = "";

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('teacher-avatars')
          .upload(fileName, avatarFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('teacher-avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        } else {
          toast.error("Failed to upload avatar. Continuing without avatar.");
        }
      }

      const { error } = await supabase.from('teacher_profiles').insert({
        user_id: user.id,
        full_name: formData.fullName,
        avatar_url: avatarUrl || null,
        phone_number: formData.phoneNumber,
        subjects: formData.subjects.split(',').map(s => s.trim()),
        years_experience: parseInt(formData.yearsExperience) || 0,
        student_education_level: formData.studentEducationLevel,
        teaching_goals: formData.teachingGoals,
        style_notes: formData.teachingStyle,
        teaching_examples: formData.teachingExample,
        sample_explanation: formData.additionalNotes,
      });

      if (error) throw error;

      toast.success("Profile created successfully!");
      navigate('/teacher/dashboard');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("A profile already exists for this account. Redirecting to dashboard...");
        setTimeout(() => navigate('/teacher/dashboard'), 2000);
      } else {
        toast.error(error.message || "Error creating profile. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="John Doe"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Profile Picture (Optional)</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt="Preview" />
                  ) : (
                    <AvatarFallback>
                      {formData.fullName ? formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : 'T'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">Upload Photo</span>
                    </div>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-2">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjects">Subjects You Teach *</Label>
              <Input
                id="subjects"
                placeholder="e.g., Math, Physics, Chemistry"
                value={formData.subjects}
                onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple subjects with commas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearsExperience">Years of Teaching Experience *</Label>
              <Input
                id="yearsExperience"
                type="number"
                min="0"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                required
                placeholder="5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentEducationLevel">Student Level</Label>
              <Input
                id="studentEducationLevel"
                placeholder="e.g., Middle School, High School, University"
                value={formData.studentEducationLevel}
                onChange={(e) => setFormData({ ...formData, studentEducationLevel: e.target.value })}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="teachingGoals">What are your main teaching goals?</Label>
              <Textarea
                id="teachingGoals"
                placeholder="Brief description (1-2 sentences)"
                value={formData.teachingGoals}
                onChange={(e) => setFormData({ ...formData, teachingGoals: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                e.g., "Help students develop critical thinking skills and build confidence in problem-solving"
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teachingStyle">Describe your teaching style</Label>
              <Textarea
                id="teachingStyle"
                placeholder="How would you describe your approach to teaching?"
                value={formData.teachingStyle}
                onChange={(e) => setFormData({ ...formData, teachingStyle: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Include your tone, personality, values, and approach (e.g., patient, structured, encourages questions, uses real-world examples)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teachingExample">Share a brief teaching example</Label>
              <Textarea
                id="teachingExample"
                placeholder="How do you explain a concept or give feedback to students?"
                value={formData.teachingExample}
                onChange={(e) => setFormData({ ...formData, teachingExample: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Write a short example that shows your natural teaching voice
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalNotes">Anything else we should know? (Optional)</Label>
              <Textarea
                id="additionalNotes"
                placeholder="Any specific preferences or additional context..."
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                rows={3}
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
          <CardTitle>Teacher Profile Setup</CardTitle>
          <CardDescription>
            Step {step} of {totalSteps}: {step === 1 ? "Essential Information" : "Teaching Style & Approach"}
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
              <Button onClick={handleSubmit} className="flex-1" disabled={loading || !formData.fullName || !formData.subjects || !formData.yearsExperience}>
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

export default TeacherOnboarding;