import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StudentAlert, AlertLevel } from '@/types/alerts';
import { ALERT_TYPE_LABELS, ALERT_LEVEL_COLORS } from '@/types/alerts';
import { useTranslation } from 'react-i18next';

interface WellbeingAlertCardProps {
  alerts: StudentAlert[];
  studentName: string;
  onAcknowledge?: () => void;
}

export function WellbeingAlertCard({
  alerts,
  studentName,
  onAcknowledge,
}: WellbeingAlertCardProps) {
  const { t } = useTranslation();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  if (!alerts || alerts.length === 0) {
    return null;
  }

  // Consolidate alerts - get unique alert types and most severe level
  const uniqueAlertTypes = Array.from(new Set(alerts.map((a) => a.alert_type)));
  const hasAnyAcknowledged = alerts.some((a) => a.is_acknowledged);
  const hasAnyUnacknowledged = alerts.some((a) => !a.is_acknowledged);

  const mostSevereLevel: AlertLevel = alerts.some((a) => a.alert_level === 'critical')
    ? 'critical'
    : 'concerning';
  const colors = ALERT_LEVEL_COLORS[mostSevereLevel];

  // Get all unique triggered messages (avoid duplicates)
  const allTriggeredMessages = Array.from(
    new Map(
      alerts.flatMap((a) => a.triggered_messages).map((tm) => [tm.message_index, tm])
    ).values()
  );

  // Get the most comprehensive AI analysis (use the longest one)
  const bestAnalysis = alerts.reduce((best, current) =>
    current.ai_analysis.length > best.ai_analysis.length ? current : best
  ).ai_analysis;

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('student_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id,
        })
        .eq('id', alertId);

      if (error) throw error;

      toast.success('Alert acknowledged');
      onAcknowledge?.();
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    } finally {
      setAcknowledging(null);
    }
  };

  const handleAcknowledgeAll = async () => {
    setAcknowledging('all');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const unacknowledgedIds = alerts.filter((a) => !a.is_acknowledged).map((a) => a.id);

      const { error } = await supabase
        .from('student_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id,
        })
        .in('id', unacknowledgedIds);

      if (error) throw error;

      toast.success('All alerts acknowledged');
      onAcknowledge?.();
    } catch (error) {
      toast.error('Failed to acknowledge alerts');
    } finally {
      setAcknowledging(null);
    }
  };

  return (
    <Card className={`border-2 ${colors.border} ${colors.bg}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`h-6 w-6 ${colors.text} mt-1`} />
            <div>
              <CardTitle className={`text-xl ${colors.text}`}>
                {mostSevereLevel === 'critical'
                  ? `🚨 ${t('wellbeing.level.critical')} ${t('wellbeing.alert')}`
                  : `⚠️ ${t('wellbeing.level.concerning')}`}
              </CardTitle>
              <CardDescription className="mt-1">
                Concerning signs detected in {studentName}'s conversation
              </CardDescription>
            </div>
          </div>
          {hasAnyUnacknowledged && (
            <Button
              variant={mostSevereLevel === 'critical' ? 'destructive' : 'default'}
              size="sm"
              onClick={handleAcknowledgeAll}
              disabled={acknowledging !== null}
            >
              {acknowledging === 'all' ? (
                <>
                  <Clock className="h-4 w-4 me-2 animate-spin" />
                  Acknowledging...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 me-2" />
                  Acknowledge All
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consolidated alert display */}
        <div className="p-4 rounded-lg border bg-white border-gray-300">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={mostSevereLevel === 'critical' ? 'destructive' : 'default'}>
                {mostSevereLevel.toUpperCase()}
              </Badge>
              {uniqueAlertTypes.map((type) => (
                <Badge key={type} variant="outline">
                  {ALERT_TYPE_LABELS[type]}
                </Badge>
              ))}
              {hasAnyAcknowledged && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Acknowledged
                </Badge>
              )}
            </div>
          </div>

          <div className="mb-3">
            <h4 className="font-semibold text-sm mb-2">AI Analysis:</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{bestAnalysis}</p>
          </div>

          {allTriggeredMessages.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Concerning Messages:</h4>
              <div className="space-y-2">
                {allTriggeredMessages.map((msg, idx) => (
                  <div key={idx} className="bg-red-50 border-l-4 border-red-400 p-3 text-sm">
                    <p className="text-gray-800 mb-1">"{msg.content}"</p>
                    <p className="text-red-700 text-xs italic">{msg.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasAnyAcknowledged && alerts[0].acknowledged_at && (
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
              Acknowledged on {new Date(alerts[0].acknowledged_at).toLocaleString()}
            </div>
          )}
        </div>

        {mostSevereLevel === 'critical' && (
          <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-sm font-semibold text-red-900 mb-2">
              ⚠️ Immediate Action Recommended
            </p>
            <p className="text-sm text-red-800">
              This is a critical alert. Please reach out to {studentName} immediately to ensure
              their safety and wellbeing. Consider involving school counseling services or mental
              health professionals if appropriate.
            </p>
            <p className="text-xs text-red-700 mt-2">
              If you believe the student is in immediate danger, contact emergency services or your
              institution's crisis response team.
            </p>
          </div>
        )}

        {mostSevereLevel === 'concerning' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm font-semibold text-yellow-900 mb-2">💡 Recommended Action</p>
            <p className="text-sm text-yellow-800">
              Please check in with {studentName} to provide support and guidance. Early intervention
              can make a significant difference in student wellbeing and academic success.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
