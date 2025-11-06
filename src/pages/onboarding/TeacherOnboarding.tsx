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
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";

const TeacherOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [formData, setFormData] = useState({
    // Part 1: Personal Information
    fullName: "",
    phoneNumber: "",
    specialization1: "",
    specialization2: "",
    subjects: "",
    yearsExperience: "",
    workplace: "",
    
    // Part 2: Student Overview
    typicalStudentCount: "",
    studentAgeRange: "",
    studentEducationLevel: "",
    studentObjectives: "",
    
    // Part 3: Teaching Goals
    teachingGoals: "",
    styleNotes: "",
    
    // Part 4: Teacher Voice & Style (A - Tone)
    lessonStartApproach: "",
    mistakeResponse: "",
    encouragementPhrases: "",
    phrasesToAvoid: "",
    teachingExamples: "",
    sampleExplanation: "",
    
    // Part 4B: Classroom Approach
    lessonStructure: "",
    discussionTiming: "",
    questionTypes: "",
    lessonEnding: "",
    
    // Part 4C: Pedagogical Principles
    educationalValues: "",
    skillsToDevelop: "",
    strongestQualities: "",
    
    // Part 4D: Real Examples
    difficultConceptExample: "",
    hardWorkFeedbackExample: "",
    misunderstandingFeedbackExample: "",
    
    // Part 4E: Challenging Situations
    disruptiveStudentResponse: "",
    noUnderstandingResponse: "",
    challengingQuestionResponse: "",
  });

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('teacher_profiles').insert({
        user_id: user.id,
        full_name: formData.fullName,
        phone_number: formData.phoneNumber,
        specialization_1: formData.specialization1,
        specialization_2: formData.specialization2,
        subjects: formData.subjects.split(',').map(s => s.trim()),
        years_experience: parseInt(formData.yearsExperience) || 0,
        workplace: formData.workplace,
        typical_student_count: formData.typicalStudentCount,
        student_age_range: formData.studentAgeRange,
        student_education_level: formData.studentEducationLevel,
        student_objectives: formData.studentObjectives,
        teaching_goals: formData.teachingGoals,
        style_notes: formData.styleNotes,
        lesson_start_approach: formData.lessonStartApproach,
        mistake_response: formData.mistakeResponse,
        encouragement_phrases: formData.encouragementPhrases,
        phrases_to_avoid: formData.phrasesToAvoid,
        teaching_examples: formData.teachingExamples,
        sample_explanation: formData.sampleExplanation,
        lesson_structure: formData.lessonStructure,
        discussion_timing: formData.discussionTiming,
        question_types: formData.questionTypes,
        lesson_ending: formData.lessonEnding,
        educational_values: formData.educationalValues,
        skills_to_develop: formData.skillsToDevelop,
        strongest_qualities: formData.strongestQualities,
        difficult_concept_example: formData.difficultConceptExample,
        hard_work_feedback_example: formData.hardWorkFeedbackExample,
        misunderstanding_feedback_example: formData.misunderstandingFeedbackExample,
        disruptive_student_response: formData.disruptiveStudentResponse,
        no_understanding_response: formData.noUnderstandingResponse,
        challenging_question_response: formData.challengingQuestionResponse,
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
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialization1">Specialization 1</Label>
              <Input
                id="specialization1"
                placeholder="e.g., Mathematics"
                value={formData.specialization1}
                onChange={(e) => setFormData({ ...formData, specialization1: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialization2">Specialization 2</Label>
              <Input
                id="specialization2"
                placeholder="e.g., Science"
                value={formData.specialization2}
                onChange={(e) => setFormData({ ...formData, specialization2: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjects">Subjects (comma-separated) *</Label>
              <Input
                id="subjects"
                placeholder="Math, Science, English"
                value={formData.subjects}
                onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearsExperience">Years of Teaching Experience *</Label>
              <Input
                id="yearsExperience"
                type="number"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workplace">Current Workplace</Label>
              <Input
                id="workplace"
                placeholder="School / Institution / Private Tutor"
                value={formData.workplace}
                onChange={(e) => setFormData({ ...formData, workplace: e.target.value })}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="typicalStudentCount">Typical Number of Students per Class</Label>
              <Input
                id="typicalStudentCount"
                placeholder="e.g., 15-20"
                value={formData.typicalStudentCount}
                onChange={(e) => setFormData({ ...formData, typicalStudentCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentAgeRange">Students' Age Range</Label>
              <Input
                id="studentAgeRange"
                placeholder="e.g., 12-16"
                value={formData.studentAgeRange}
                onChange={(e) => setFormData({ ...formData, studentAgeRange: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentEducationLevel">Students' Educational Level</Label>
              <Input
                id="studentEducationLevel"
                placeholder="Elementary / Middle School / High School / University"
                value={formData.studentEducationLevel}
                onChange={(e) => setFormData({ ...formData, studentEducationLevel: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentObjectives">Students' Main Objectives</Label>
              <Textarea
                id="studentObjectives"
                placeholder="Exam Prep / Skill Development / Advanced Study / Remedial Support"
                value={formData.studentObjectives}
                onChange={(e) => setFormData({ ...formData, studentObjectives: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teachingGoals">Your Teaching Goals</Label>
              <Textarea
                id="teachingGoals"
                placeholder="What are your main teaching objectives?"
                value={formData.teachingGoals}
                onChange={(e) => setFormData({ ...formData, teachingGoals: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="styleNotes">Teaching Style Notes</Label>
              <Textarea
                id="styleNotes"
                placeholder="Describe your teaching approach..."
                value={formData.styleNotes}
                onChange={(e) => setFormData({ ...formData, styleNotes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Tone & Communication Style</h3>
            <div className="space-y-2">
              <Label htmlFor="lessonStartApproach">How do you typically start a lesson?</Label>
              <Textarea
                id="lessonStartApproach"
                value={formData.lessonStartApproach}
                onChange={(e) => setFormData({ ...formData, lessonStartApproach: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mistakeResponse">How do you respond when a student makes a mistake?</Label>
              <Textarea
                id="mistakeResponse"
                value={formData.mistakeResponse}
                onChange={(e) => setFormData({ ...formData, mistakeResponse: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="encouragementPhrases">What language or phrases do you use when encouraging students?</Label>
              <Textarea
                id="encouragementPhrases"
                value={formData.encouragementPhrases}
                onChange={(e) => setFormData({ ...formData, encouragementPhrases: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phrasesToAvoid">What phrases or tones do you intentionally avoid?</Label>
              <Textarea
                id="phrasesToAvoid"
                value={formData.phrasesToAvoid}
                onChange={(e) => setFormData({ ...formData, phrasesToAvoid: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teachingExamples">Do you use humor, stories, analogies, or real-life examples? Describe.</Label>
              <Textarea
                id="teachingExamples"
                value={formData.teachingExamples}
                onChange={(e) => setFormData({ ...formData, teachingExamples: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sampleExplanation">Provide a short sample explanation of a topic you enjoy teaching</Label>
              <Textarea
                id="sampleExplanation"
                placeholder="Write in your natural voice..."
                value={formData.sampleExplanation}
                onChange={(e) => setFormData({ ...formData, sampleExplanation: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Classroom Approach & Principles</h3>
            <div className="space-y-2">
              <Label htmlFor="lessonStructure">Describe your typical lesson structure</Label>
              <Textarea
                id="lessonStructure"
                value={formData.lessonStructure}
                onChange={(e) => setFormData({ ...formData, lessonStructure: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discussionTiming">How long do you usually talk before inviting discussion or questions?</Label>
              <Input
                id="discussionTiming"
                value={formData.discussionTiming}
                onChange={(e) => setFormData({ ...formData, discussionTiming: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="questionTypes">What types of questions do you ask to deepen understanding?</Label>
              <Textarea
                id="questionTypes"
                value={formData.questionTypes}
                onChange={(e) => setFormData({ ...formData, questionTypes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lessonEnding">How do you usually end or summarize a lesson?</Label>
              <Textarea
                id="lessonEnding"
                value={formData.lessonEnding}
                onChange={(e) => setFormData({ ...formData, lessonEnding: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="educationalValues">What are the educational values or principles that guide your teaching?</Label>
              <Textarea
                id="educationalValues"
                value={formData.educationalValues}
                onChange={(e) => setFormData({ ...formData, educationalValues: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skillsToDevelop">What skills or habits of mind do you try to develop in your students?</Label>
              <Textarea
                id="skillsToDevelop"
                placeholder="e.g., critical thinking, curiosity, discipline"
                value={formData.skillsToDevelop}
                onChange={(e) => setFormData({ ...formData, skillsToDevelop: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strongestQualities">What do you consider your strongest qualities as an instructor?</Label>
              <Textarea
                id="strongestQualities"
                value={formData.strongestQualities}
                onChange={(e) => setFormData({ ...formData, strongestQualities: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Real Examples & Challenging Situations</h3>
            <div className="space-y-2">
              <Label htmlFor="difficultConceptExample">Write an example of how you explained a difficult concept to a student</Label>
              <Textarea
                id="difficultConceptExample"
                value={formData.difficultConceptExample}
                onChange={(e) => setFormData({ ...formData, difficultConceptExample: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hardWorkFeedbackExample">Write an example of feedback you gave a student who tried hard</Label>
              <Textarea
                id="hardWorkFeedbackExample"
                value={formData.hardWorkFeedbackExample}
                onChange={(e) => setFormData({ ...formData, hardWorkFeedbackExample: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="misunderstandingFeedbackExample">Write an example of feedback you gave a student who misunderstood the material</Label>
              <Textarea
                id="misunderstandingFeedbackExample"
                value={formData.misunderstandingFeedbackExample}
                onChange={(e) => setFormData({ ...formData, misunderstandingFeedbackExample: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disruptiveStudentResponse">How do you respond to a disruptive student?</Label>
              <Textarea
                id="disruptiveStudentResponse"
                value={formData.disruptiveStudentResponse}
                onChange={(e) => setFormData({ ...formData, disruptiveStudentResponse: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noUnderstandingResponse">How do you respond when no one understands the material?</Label>
              <Textarea
                id="noUnderstandingResponse"
                value={formData.noUnderstandingResponse}
                onChange={(e) => setFormData({ ...formData, noUnderstandingResponse: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="challengingQuestionResponse">How do you handle a student question that challenges assumptions or raises a sensitive issue?</Label>
              <Textarea
                id="challengingQuestionResponse"
                value={formData.challengingQuestionResponse}
                onChange={(e) => setFormData({ ...formData, challengingQuestionResponse: e.target.value })}
                rows={2}
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
            Step {step} of {totalSteps}: {step === 1 ? "Personal Information" : step === 2 ? "Student Overview" : step === 3 ? "Teaching Style" : step === 4 ? "Classroom Approach" : "Examples & Situations"}
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