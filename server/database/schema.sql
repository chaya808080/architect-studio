CREATE TABLE [Clients] (
    [Id] int NOT NULL IDENTITY,
    [FirstName] nvarchar(50) NOT NULL,
    [LastName] nvarchar(50) NOT NULL,
    [Phone] nvarchar(20) NOT NULL,
    [Email] nvarchar(120) NOT NULL,
    [City] nvarchar(40) NOT NULL,
    [Source] nvarchar(30) NOT NULL,
    [CreatedAt] date NOT NULL,
    [Notes] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_Clients] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [Inspirations] (
    [Id] int NOT NULL IDENTITY,
    [Title] nvarchar(max) NOT NULL,
    [Style] nvarchar(max) NOT NULL,
    [Room] nvarchar(max) NOT NULL,
    [Image] nvarchar(max) NOT NULL,
    [Likes] int NOT NULL,
    CONSTRAINT [PK_Inspirations] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [WorkingHours] (
    [Id] int NOT NULL IDENTITY,
    [DayOfWeek] int NOT NULL,
    [From] nvarchar(max) NOT NULL,
    [To] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_WorkingHours] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [Projects] (
    [Id] int NOT NULL IDENTITY,
    [ClientId] int NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [Type] nvarchar(max) NOT NULL,
    [Stage] nvarchar(30) NOT NULL,
    [Style] nvarchar(max) NOT NULL,
    [City] nvarchar(max) NOT NULL,
    [Area] int NOT NULL,
    [Budget] decimal(12,2) NOT NULL,
    [Fee] decimal(12,2) NOT NULL,
    [StartDate] date NOT NULL,
    [DueDate] date NOT NULL,
    [CreatedAt] date NOT NULL,
    [StageChangedAt] date NOT NULL,
    [Palette] nvarchar(200) NOT NULL,
    [Notes] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_Projects] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Projects_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Approvals] (
    [Id] int NOT NULL IDENTITY,
    [ProjectId] int NOT NULL,
    [Title] nvarchar(max) NOT NULL,
    [Version] int NOT NULL,
    [Status] nvarchar(max) NOT NULL,
    [Comment] nvarchar(max) NOT NULL,
    [Date] date NOT NULL,
    CONSTRAINT [PK_Approvals] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Approvals_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [BudgetItems] (
    [Id] int NOT NULL IDENTITY,
    [ProjectId] int NOT NULL,
    [Category] nvarchar(max) NOT NULL,
    [Planned] decimal(12,2) NOT NULL,
    [Actual] decimal(12,2) NOT NULL,
    CONSTRAINT [PK_BudgetItems] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_BudgetItems_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [Meetings] (
    [Id] int NOT NULL IDENTITY,
    [ClientId] int NOT NULL,
    [ProjectId] int NULL,
    [Type] nvarchar(max) NOT NULL,
    [Date] date NOT NULL,
    [From] nvarchar(5) NOT NULL,
    [To] nvarchar(5) NOT NULL,
    [City] nvarchar(max) NOT NULL,
    [Status] nvarchar(max) NOT NULL,
    [Notes] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_Meetings] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Meetings_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Meetings_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE SET NULL
);
GO


CREATE TABLE [Payments] (
    [Id] int NOT NULL IDENTITY,
    [ProjectId] int NOT NULL,
    [Label] nvarchar(max) NOT NULL,
    [Percent] decimal(5,2) NOT NULL,
    [Amount] decimal(12,2) NOT NULL,
    [DueDate] date NOT NULL,
    [PaidDate] date NULL,
    CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Payments_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [Tasks] (
    [Id] int NOT NULL IDENTITY,
    [ProjectId] int NOT NULL,
    [Phase] nvarchar(max) NOT NULL,
    [Title] nvarchar(max) NOT NULL,
    [DueDate] date NOT NULL,
    [Done] bit NOT NULL,
    CONSTRAINT [PK_Tasks] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Tasks_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
);
GO


CREATE INDEX [IX_Approvals_ProjectId] ON [Approvals] ([ProjectId]);
GO


CREATE INDEX [IX_BudgetItems_ProjectId] ON [BudgetItems] ([ProjectId]);
GO


CREATE INDEX [IX_Meetings_ClientId] ON [Meetings] ([ClientId]);
GO


CREATE INDEX [IX_Meetings_Date] ON [Meetings] ([Date]);
GO


CREATE INDEX [IX_Meetings_ProjectId] ON [Meetings] ([ProjectId]);
GO


CREATE INDEX [IX_Payments_DueDate] ON [Payments] ([DueDate]);
GO


CREATE INDEX [IX_Payments_ProjectId] ON [Payments] ([ProjectId]);
GO


CREATE INDEX [IX_Projects_ClientId] ON [Projects] ([ClientId]);
GO


CREATE INDEX [IX_Projects_Stage] ON [Projects] ([Stage]);
GO


CREATE INDEX [IX_Tasks_ProjectId] ON [Tasks] ([ProjectId]);
GO


