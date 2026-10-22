export type LessonMaterialType =
    | 'market_artifact'
    | 'local_file'
    | 'web_url'
    | 'cloud_school_app';

export interface LessonMaterialRef {
    id: string;
    title: string;
    type: LessonMaterialType;
    subject: string;
    grade?: number;
    keywords: string[];
    urlOrPath: string;
    artifactId?: string;
    description?: string;
    autoFullscreen?: boolean;
}

export interface PeriodMaterialBinding {
    day: string;
    period: number;
    subject: string;
    topic: string;
    materials: LessonMaterialRef[];
    updatedAt: string;
}

export interface SelfCheckItem {
    id: string;
    label: string;
    category: 'attendance' | 'task';
    completed: boolean;
    completedAt?: string;
    sessionToken: string;
}

export interface LessonSchedulerConfig {
    autoAlert: boolean;
    autoFullscreen: boolean;
}
