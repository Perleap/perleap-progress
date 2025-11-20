import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get the request body
    const { userId, userRole } = await req.json();

    // Security check: User can only delete their own account
    if (user.id !== userId) {
      throw new Error('Unauthorized: You can only delete your own account');
    }

    if (!userRole || (userRole !== 'teacher' && userRole !== 'student')) {
      throw new Error('Invalid user role');
    }

    console.log(`Starting account deletion for user ${userId} (${userRole})`);

    // Start a transaction-like deletion process
    // Note: Supabase Postgres has CASCADE DELETE set up, so deleting the profile
    // will cascade delete related data automatically

    if (userRole === 'teacher') {
      // Delete teacher-specific data
      console.log('Deleting teacher classrooms and related data...');
      
      // Get all classrooms for this teacher
      const { data: classrooms } = await supabaseClient
        .from('classrooms')
        .select('id')
        .eq('teacher_id', userId);

      if (classrooms && classrooms.length > 0) {
        const classroomIds = classrooms.map((c) => c.id);
        
        // Delete assignments for these classrooms (cascade will handle submissions)
        await supabaseClient
          .from('assignments')
          .delete()
          .in('classroom_id', classroomIds);
        
        // Delete enrollments
        await supabaseClient
          .from('enrollments')
          .delete()
          .in('classroom_id', classroomIds);
        
        // Delete classrooms
        await supabaseClient
          .from('classrooms')
          .delete()
          .in('id', classroomIds);
      }

      // Delete teacher notifications
      await supabaseClient
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      // Delete teacher profile (this will cascade delete 5D snapshots)
      console.log('Deleting teacher profile...');
      const { error: profileError } = await supabaseClient
        .from('teacher_profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error deleting teacher profile:', profileError);
        throw new Error(`Failed to delete teacher profile: ${profileError.message}`);
      }
    } else if (userRole === 'student') {
      // Delete student-specific data
      console.log('Deleting student submissions and related data...');
      
      // Delete submissions
      await supabaseClient
        .from('submissions')
        .delete()
        .eq('student_id', userId);

      // Delete enrollments
      await supabaseClient
        .from('enrollments')
        .delete()
        .eq('student_id', userId);

      // Delete 5D snapshots
      await supabaseClient
        .from('five_d_snapshots')
        .delete()
        .eq('student_id', userId);

      // Delete hard skill assessments
      await supabaseClient
        .from('hard_skill_assessments')
        .delete()
        .eq('student_id', userId);

      // Delete student alerts
      await supabaseClient
        .from('student_alerts')
        .delete()
        .eq('student_id', userId);

      // Delete notifications
      await supabaseClient
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      // Delete student profile
      console.log('Deleting student profile...');
      const { error: profileError } = await supabaseClient
        .from('student_profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error deleting student profile:', profileError);
        throw new Error(`Failed to delete student profile: ${profileError.message}`);
      }
    }

    // Finally, delete the auth user
    console.log('Deleting auth user...');
    const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      throw new Error(`Failed to delete auth user: ${authError.message}`);
    }

    console.log(`Successfully deleted account for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in delete-user-account function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while deleting the account',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

