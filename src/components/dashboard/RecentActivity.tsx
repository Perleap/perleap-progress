import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRecentActivity } from '@/hooks/queries';

export function RecentActivity() {
    const { user, profile } = useAuth();
    const { data: activities = [], isLoading: loading } = useRecentActivity(user?.id, profile);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading && activities.length === 0) return (
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
