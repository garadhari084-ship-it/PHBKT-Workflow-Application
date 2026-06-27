import NewUserForm from '@/components/app/new-user-form';

export default function NewUserPage() {
  return (
    <div className="w-full bg-background flex-1 overflow-y-auto px-2 md:px-4 lg:px-6 py-4 md:py-6">
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
