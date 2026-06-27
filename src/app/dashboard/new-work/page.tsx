import NewWorkItemForm from '@/components/app/new-work-item-form';

export default function NewWorkPage() {
  return (
    <div className="w-full bg-background flex-1 overflow-y-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 space-y-4">
      <NewWorkItemForm />
    </div>
  );
}
