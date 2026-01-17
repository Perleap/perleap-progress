import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, BookOpen, FileText, User, Eye, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ActivityEvent {
    id: string;
    type: 'create' | 'update' | 'delete' | 'view';
    entity_type: 'classroom' | 'assignment' | 'submission' | 'student';
    entity_id: string;
    title: string;
    route: string;
    created_at: string;
    performer?: {
        name: string;
        avatar_url?: string;
    };
}

export function RecentActivity() {
    const { user, profile } = useAuth();
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchActivity();
        }
    }, [user?.id, profile]);

    const fetchActivity = async () => {
        try {
            const { data, error } = await supabase
                .from('activity_events' as any)
                .select('*')
                .eq('teacher_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            const events = (data as any) || [];

            // Fetch performer info for each event
            const submissionIds = events
                .filter((e: any) => e.entity_type === 'submission')
                .map((e: any) => e.entity_id);

            let studentProfilesMap: Record<string, { name: string; avatar_url: string }> = {};

            if (submissionIds.length > 0) {
                // Get student_ids from submissions
                const { data: submissions } = await supabase
                    .from('submissions')
                    .select('id, student_id')
                    .in('id', submissionIds);

                if (submissions && submissions.length > 0) {
                    const studentIds = submissions.map(s => s.student_id);
                    const { data: profiles } = await supabase
                        .from('student_profiles')
                        .select('user_id, full_name, avatar_url')
                        .in('user_id', studentIds);

                    if (profiles) {
                        const profileLookup = profiles.reduce((acc, p) => {
                            acc[p.user_id] = { name: p.full_name, avatar_url: p.avatar_url };
                            return acc;
                        }, {} as any);

                        studentProfilesMap = submissions.reduce((acc, s) => {
                            if (profileLookup[s.student_id]) {
                                acc[s.id] = profileLookup[s.student_id];
                            }
                            return acc;
                        }, {} as any);
                    }
                }
            }

            const enrichedActivities = events.map((event: any) => {
                let performer = {
                    name: profile?.full_name || 'Teacher',
                    avatar_url: profile?.avatar_url
                };

                if (event.entity_type === 'submission' && studentProfilesMap[event.entity_id]) {
                    performer = studentProfilesMap[event.entity_id];
                }

                // Fix for submission routes which might be incorrectly formatted in the database
                let route = event.route;
                if (event.entity_type === 'submission' && event.entity_id) {
                    route = `/teacher/submission/${event.entity_id}`;
                }

                return {
                    ...event,
                    performer,
                    route
                };
            });

            setActivities(enrichedActivities);
        } catch (error) {
            console.error('Error fetching activity:', error);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading) return (
        <Card className="h-full">
            <CardContent className="h-full flex items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    );

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
                {activities.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                        No recent activity recorded.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0 last:pb-0">
                                <Avatar className="h-9 w-9 border border-border/50">
                                    <AvatarImage src={activity.performer?.avatar_url} />
                                    <AvatarFallback className="text-[10px] bg-muted">
                                        {activity.performer ? getInitials(activity.performer.name) : '??'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1 min-w-0">
                                    <p className="text-sm font-medium leading-none truncate text-foreground">
                                        <Link to={activity.route} className="hover:underline hover:text-primary transition-colors">
                                            {activity.title}
                                        </Link>
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                        <span className="font-bold text-[10px] text-foreground shrink-0">
                                            {activity.performer?.name}
                                        </span>
                                        <span className="text-[10px]">•</span>
                                        <span className="text-[10px]">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
