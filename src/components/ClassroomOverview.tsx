import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, FileText, Target, Link as LinkIcon, Clock, Edit, Trash2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ClassroomOverviewProps {
    classroom: {
        name: string;
        subject: string;
        description?: string;
        invite_code: string;
        created_at?: string;
    };
    onEdit?: () => void;
    onDelete?: () => void;
}

export function ClassroomOverview({ classroom, onEdit, onDelete }: ClassroomOverviewProps) {
    const { t } = useTranslation();
    const [openSkills, setOpenSkills] = useState<{ [key: string]: boolean }>({});

    // Mock data for fields not yet in DB
    const courseData = {
        startDate: new Date().toLocaleDateString(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toLocaleDateString(),
        subjectAreas: [
            {
                name: "Mathematics",
                skills: ["Problem Solving", "Logical Reasoning", "Pattern Recognition", "Quantitative Analysis"]
            },
            {
                name: "Critical Thinking",
                skills: ["Analysis", "Evaluation", "Inference", "Explanation"]
            },
            {
                name: "Communication",
                skills: ["Written Expression", "Verbal Communication", "Active Listening", "Presentation"]
            }
        ],
        resources: [
            { title: "Textbook: " + classroom.subject + " Fundamentals", type: "PDF" },
            { title: "Online Lecture Series", type: "Video" },
            { title: "Practice Exercises", type: "Link" }
        ],
        outcomes: [
            "Master fundamental concepts of " + classroom.subject,
            "Apply theoretical knowledge to practical problems",
            "Develop critical thinking and analysis skills",
            "Collaborate effectively on group projects"
        ]
    };

    const toggleSkill = (skillName: string) => {
        setOpenSkills(prev => ({ ...prev, [skillName]: !prev[skillName] }));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
                {onEdit && (
                    <Button
                        onClick={onEdit}
                        variant="outline"
                        className="gap-2"
                    >
                        <Edit className="h-4 w-4" />
                        {t('common.edit')}
                    </Button>
                )}
                {onDelete && (
                    <Button
                        onClick={onDelete}
                        variant="destructive"
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        {t('common.delete')}
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BookOpen className="h-5 w-5 text-primary" />
                            {t('classroomDetail.overview.courseInfo')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">{t('classroomDetail.overview.courseTitle')}</label>
                                <p className="font-medium text-lg">{classroom.name}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">{t('common.subject')}</label>
                                <p className="font-medium text-lg">{classroom.subject}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">{t('classroomDetail.code')}</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-base px-3 py-1 font-mono tracking-wider">
                                        {classroom.invite_code}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">{t('classroomDetail.overview.duration')}</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>4 Months</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('classroomDetail.overview.courseDates')}</label>
                            <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span className="font-medium">{courseData.startDate}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium">{courseData.endDate}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <FileText className="h-5 w-5 text-primary" />
                            Skills & Subject Areas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-muted-foreground">{classroom.description || "No description provided."}</p>
                            <div className="space-y-2">
                                {courseData.subjectAreas.map((area, i) => (
                                    <Collapsible
                                        key={i}
                                        open={openSkills[area.name]}
                                        onOpenChange={() => toggleSkill(area.name)}
                                    >
                                        <CollapsibleTrigger asChild>
                                            <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground">
                                                        {i + 1}
                                                    </div>
                                                    <span className="font-medium">{area.name}</span>
                                                </div>
                                                <ChevronDown className={`h-4 w-4 transition-transform ${openSkills[area.name] ? 'rotate-180' : ''}`} />
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 ml-9 space-y-2">
                                            {area.skills.map((skill, j) => (
                                                <div key={j} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                                    <span className="text-sm text-muted-foreground">{skill}</span>
                                                </div>
                                            ))}
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <LinkIcon className="h-5 w-5 text-primary" />
                            {t('classroomDetail.overview.resources')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {courseData.resources.map((resource, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            {resource.type === 'PDF' ? <FileText className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm group-hover:text-primary transition-colors">{resource.title}</p>
                                            <p className="text-xs text-muted-foreground">{resource.type}</p>
                                        </div>
                                    </div>
                                    <LinkIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Target className="h-5 w-5 text-primary" />
                            {t('classroomDetail.overview.learningOutcomes')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {courseData.outcomes.map((outcome, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                    <span className="text-sm text-muted-foreground">{outcome}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
