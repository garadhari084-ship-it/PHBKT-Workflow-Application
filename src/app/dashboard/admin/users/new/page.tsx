import NewUserForm from '@/components/app/new-user-form';

export default function NewUserPage() {
  return (
    <div className="w-full bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create New User</h1>
          <p className="text-sm text-muted-foreground">Fill out the form below to create a new user account.</p>
        </div>
        <NewUserForm />
      </div>
    </div>
  );
}
