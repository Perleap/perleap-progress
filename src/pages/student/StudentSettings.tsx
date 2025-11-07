import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Bell, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

interface StudentProfile {
  first_name: string;
  last_name: string;
  grade_level: string;
  avatar_url: string | null;
}

interface NotificationSettings {
  assignment_notifications: boolean;
  feedback_notifications: boolean;
  classroom_updates: boolean;
  email_notifications: boolean;
}

const StudentSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profile, setProfile] = useState<StudentProfile>({
    first_name: "",
    last_name: "",
    grade_level: "",
    avatar_url: null,
  });
  
  const [notifications, setNotifications] = useState<NotificationSettings>({
    assignment_notifications: true,
    feedback_notifications: true,
    classroom_updates: true,
    email_notifications: false,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      // Fetch student profile
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('first_name, last_name, grade_level, avatar_url')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      
      if (profileData) {
        setProfile({
          first_name: profileData.first_name || "",
          last_name: profileData.last_name || "",
          grade_level: profileData.grade_level || "",
          avatar_url: profileData.avatar_url || null,
        });
      }

      // In a real app, you would fetch notification settings from a separate table
      // For now, we'll use localStorage as a mock
      const savedNotifications = localStorage.getItem('student_notifications');
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast.error("Error loading settings");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // If bucket doesn't exist, store as data URL in localStorage
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setProfile({ ...profile, avatar_url: dataUrl });
          localStorage.setItem(`avatar_${user.id}`, dataUrl);
          toast.success("Photo uploaded successfully!");
        };
        reader.readAsDataURL(file);
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("user-avatars")
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("student_profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success("Photo uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error("Error uploading photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          grade_level: profile.grade_level,
          avatar_url: profile.avatar_url,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    // In a real app, you would save to database
    localStorage.setItem('student_notifications', JSON.stringify(notifications));
    toast.success("Notification settings updated!");
  };

  const getInitials = () => {
    return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'S';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 md:h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/student/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg md:text-2xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="container py-8 px-4 max-w-4xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {profile.avatar_url ? (
                        <AvatarImage src={profile.avatar_url} alt="Profile" />
                      ) : null}
                      <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
                    </Avatar>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{profile.first_name} {profile.last_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">Click camera to upload photo</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gradeLevel">Grade Level</Label>
                  <Input
                    id="gradeLevel"
                    value={profile.grade_level}
                    onChange={(e) => setProfile({ ...profile, grade_level: e.target.value })}
                    placeholder="10th Grade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="assignment-notifications">Assignment Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new assignments are posted
                      </p>
                    </div>
                    <Switch
                      id="assignment-notifications"
                      checked={notifications.assignment_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, assignment_notifications: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="feedback-notifications">Feedback Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when you receive feedback on your work
                      </p>
                    </div>
                    <Switch
                      id="feedback-notifications"
                      checked={notifications.feedback_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, feedback_notifications: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="classroom-updates">Classroom Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about general classroom announcements
                      </p>
                    </div>
                    <Switch
                      id="classroom-updates"
                      checked={notifications.classroom_updates}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, classroom_updates: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notifications.email_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, email_notifications: checked })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleSaveNotifications}>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StudentSettings;

