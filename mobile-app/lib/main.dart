import 'package:flutter/material.dart';

enum StaffRole { cleaner, upholsteryCleaner, handyman, manager, owner }

extension StaffRoleLabel on StaffRole {
  String get label => switch (this) {
    StaffRole.cleaner => 'Cleaner',
    StaffRole.upholsteryCleaner => 'Upholstery / Chemical Cleaning',
    StaffRole.handyman => 'Handyman',
    StaffRole.manager => 'Manager',
    StaffRole.owner => 'Owner',
  };
}

const appAccessGroups = <StaffRole>[
  StaffRole.cleaner,
  StaffRole.upholsteryCleaner,
  StaffRole.handyman,
  StaffRole.manager,
  StaffRole.owner,
];

void main() => runApp(const OneCallApp());

class OneCallApp extends StatelessWidget {
  const OneCallApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'One Call',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF137547),
          primary: const Color(0xFF137547),
          secondary: const Color(0xFF0B2545),
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        useMaterial3: true,
      ),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      const _DashboardPage(),
      const _PlaceholderPage(title: 'My jobs', detail: 'Assigned, available and completed bookings will appear here.'),
      const _PlaceholderPage(title: 'My finances', detail: 'Payment history, amounts owed to you and amounts owed to the company.'),
      const _PlaceholderPage(title: 'My profile', detail: 'Personal details, company contacts and account settings.'),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('One Call'),
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFF0B2545),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () {},
            icon: const Icon(Icons.notifications_none),
          ),
        ],
      ),
      body: SafeArea(child: pages[_tab]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.cleaning_services_outlined), label: 'Jobs'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Finance'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

class _DashboardPage extends StatelessWidget {
  const _DashboardPage();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Welcome to One Call', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text('Staff workspace', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.black54)),
        const SizedBox(height: 22),
        const _SummaryCard(icon: Icons.event_available, title: 'Upcoming jobs', value: '—', caption: 'Connect your account to load jobs'),
        const _SummaryCard(icon: Icons.payments_outlined, title: 'Company balance', value: '—', caption: 'Calculated from the verified finance ledger'),
        const _SummaryCard(icon: Icons.groups_outlined, title: 'My crew', value: '—', caption: 'Crew members are shown for each assigned job'),
        const SizedBox(height: 12),
        const Text('Access is restricted to five staff groups: Cleaner, Upholstery / Chemical Cleaning, Handyman, Manager and Owner. Customers do not have app accounts.'),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.icon, required this.title, required this.value, required this.caption});
  final IconData icon;
  final String title;
  final String value;
  final String caption;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(children: [
        CircleAvatar(backgroundColor: const Color(0xFFECF7F1), child: Icon(icon, color: const Color(0xFF137547))),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(caption, style: const TextStyle(color: Colors.black54, fontSize: 12)),
        ])),
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      ]),
    ),
  );
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({required this.title, required this.detail});
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.construction_outlined, size: 44, color: Color(0xFF137547)),
        const SizedBox(height: 14),
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(detail, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        const Text('Module scheduled for implementation after the shared API and authentication layer.', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
      ]),
    ),
  );
}
