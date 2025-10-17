'use client';

import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import PassiveModal from './PassiveModal';
import SoftDeleteModal from './SoftDeleteModal';
import ExportDataModal from './ExportDataModal';

interface SettingCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const SettingCard = ({ title, description, children }: SettingCardProps) => (
  <div className="p-4 border rounded-md">
    <h4 className="text-sm font-medium">{title}</h4>
    <p className="text-sm text-muted-foreground">{description}</p>
    <div className="pt-3">{children}</div>
  </div>
);

interface AdvancedSettingsSectionProps {
  companyId: string;
  companyName: string;
  isActive: boolean | null;
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  companyId,
  companyName,
  isActive,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <div className="flex items-center justify-between cursor-pointer mb-2">
          <h3 className="text-md font-medium">Gelişmiş Ayarlar</h3>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingCard
            title="Durum Değiştirme"
            description="Şirketi pasif yaparak erişimi kısıtlayabilir veya yeniden etkinleştirebilirsiniz."
          >
            <PassiveModal companyId={companyId} isActive={isActive ?? undefined} />
          </SettingCard>

          <SettingCard
            title="Yumuşak Silme"
            description="Şirket verileri saklanır fakat kullanıcılar erişemez; casbin politikaları temizlenir."
          >
            <SoftDeleteModal companyId={companyId} companyName={companyName} />
          </SettingCard>

          <SettingCard
            title="Verileri Dışa Aktar"
            description="Üyeler, roller ve davetler dahil olmak üzere şirket verilerini JSON olarak indir."
          >
            <ExportDataModal companyId={companyId} />
          </SettingCard>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};