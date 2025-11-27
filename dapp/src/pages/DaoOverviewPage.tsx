import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';

const incentiveItems = [
  {
    title: 'Market Innovators',
    description: 'Earn the Market Creator role after three approved suggestions and gain the ability to publish directly.',
  },
  {
    title: 'DAO Reviewers',
    description: 'Active reviewers accumulate reputation by approving accurate markets and flagging bad proposals.',
  },
  {
    title: 'Community Scouts',
    description: 'Suggest niche or high-signal markets. Highly-rated scouts receive boosted visibility and token rewards (roadmap).',
  },
];

const DaoOverviewPage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container mx-auto px-4 py-12 max-w-5xl"
    >
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          DAO Governance & Incentives
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          The Move Market DAO curates high-quality markets, manages protocol roles, and rewards contributors.
          This page outlines the lifecycle from suggestion to settlement and the incentives that keep the system
          aligned with the community.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to="/create" variant="primary">
            Suggest a Market
          </Button>
          <Button to="/admin/suggestions" variant="secondary">
            Review Queue
          </Button>
          <Button to="/admin/roles" variant="outline">
            Manage Roles
          </Button>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Governance Workflow</h2>
          <ol className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <li>
              <strong>1. Suggestion:</strong> Any wallet can submit a proposal with category, resolution source, and duration.
            </li>
            <li>
              <strong>2. Review:</strong> DAO reviewers score suggestions, upvote promising ideas, and approve or reject.
            </li>
            <li>
              <strong>3. Publication:</strong> Approved ideas are published by Market Creators or the DAO multisig.
            </li>
            <li>
              <strong>4. Settlement:</strong> Resolver role holders finalize outcomes with on-chain proofs.
            </li>
            <li>
              <strong>5. Recognition:</strong> Contributors earn reputation and eligibility for advanced roles and token rewards.
            </li>
          </ol>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Role Hierarchy</h2>
          <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li><strong>Admin:</strong> Oversees governance, manages roles, emergency controls.</li>
            <li><strong>Market Creator:</strong> Publishes curated markets once trusted by the DAO.</li>
            <li><strong>Resolver:</strong> Supplies verifiable outcomes, coordinating with oracle feeds.</li>
            <li><strong>Oracle Manager:</strong> Maintains oracle configurations and redundancy.</li>
            <li><strong>Pauser:</strong> Safeguards protocol during incidents.</li>
          </ul>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Role assignments require on-chain transactions. Use the Role Management console to grant or revoke access.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Incentive Structure</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {incentiveItems.map((item) => (
            <div key={item.title} className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Token Economics (Roadmap)</h2>
        <p className="text-gray-600 dark:text-gray-300">
          The DAO treasury earmarks a portion of protocol fees for contributor rewards. On launch, approved markets
          and accurate resolutions earn governance points redeemable for token distributions and upgraded roles.
        </p>
        <ul className="list-disc ml-6 text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>Reputation points convert to governance weight each epoch.</li>
          <li>Market creators share performance fees after successful settlement.</li>
          <li>Reviewers earn bonuses for identifying high-quality suggestions.</li>
          <li>Community voters receive seasonal airdrops proportional to participation.</li>
        </ul>
      </section>
    </motion.div>
  );
};

export default DaoOverviewPage;

