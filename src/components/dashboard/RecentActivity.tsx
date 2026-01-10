import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, BookOpen, FileText, User, Eye, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ActivityEvent {
    id: string;
    type: 'create' | 'update' | 'delete' | 'view';
    entity_type: 'classroom' | 'assignment' | 'submission' | 'student';
    title: string;
    route: string;
    created_at: string;
}

export function RecentActivity() {
    const { user } = useAuth();
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchActivity();
        }
    }, [user?.id]);

    const fetchActivity = async () => {
        try {
            const { data, error } = await supabase
                .from('activity_events' as any)
                .select('*')
                .eq('teacher_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setActivities((data as any) || []);
        } catch (error) {
            console.error('Error fetching activity:', error);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (entityType: string) => {
        if (entityType === 'classroom') return <BookOpen className="h-4 w-4 text-blue-500" />;
        if (entityType === 'assignment') return <FileText className="h-4 w-4 text-purple-500" />;
        if (entityType === 'submission') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        if (entityType === 'student') return <User className="h-4 w-4 text-orange-500" />;
        return <Eye className="h-4 w-4 text-gray-500" />;
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
            <CardContent>
                {activities.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                        No recent activity recorded.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0 last:pb-0">
                                <div className="mt-0.5 p-1.5 bg-muted/50 rounded-full border border-border/50">
                                    {getIcon(activity.entity_type)}
                                </div>
                                <div className="flex-1 space-y-1 min-w-0">
                                    <p className="text-sm font-medium leading-none truncate w-full">
                                        <Link to={activity.route} className="hover:underline hover:text-primary transition-colors">
                                            {activity.title}
                                        </Link>
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="capitalize font-medium text-xs opacity-80">{activity.type}</span>
                                        <span className="text-[10px]">•</span>
                                        <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
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
