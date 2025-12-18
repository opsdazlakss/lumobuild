import { MdRocketLaunch, MdCheck, MdDiamond, MdScreenShare, MdSupportAgent, MdStar, MdClose, MdKeyboardArrowDown, MdEmojiEmotions, MdGraphicEq } from 'react-icons/md';
import { Button } from '../shared/Button';
import { useState } from 'react';
import { useToast } from '../../context/ToastContext';

const ComparisonTable = () => {
  const features = [
    { name: "Screen Sharing", free: "❌", premium: "1080p 60fps" },
    { name: "Profile Badge", free: "❌", premium: "✅" },
    { name: "Custom Backgrounds", free: "❌", premium: "✅" },
    { name: "Upload Limit", free: "10MB", premium: "200MB" },
    { name: "GIF Avatar", free: "❌", premium: "✅" },
    { name: "Animated Banner", free: "❌", premium: "✅" },
    { name: "Profile Themes", free: "❌", premium: "✅" },
    { name: "Exclusive Stickers", free: "❌", premium: "✅" },
    { name: "Soundboard", free: "❌", premium: "✅" },
  ];

  return (
    <div className="bg-dark-sidebar/50 rounded-xl overflow-hidden border border-dark-hover">
      <div className="grid grid-cols-3 bg-dark-hover/50 p-4 text-sm font-bold text-dark-text uppercase tracking-wider">
        <div>Feature</div>
        <div className="text-center text-dark-muted">Free</div>
        <div className="text-center text-brand-primary">Premium</div>
      </div>
      <div className="divide-y divide-dark-hover">
        {features.map((feature, i) => (
          <div key={i} className="grid grid-cols-3 p-4 text-sm hover:bg-white/5 transition-colors">
            <div className="font-medium text-dark-text">{feature.name}</div>
            <div className="text-center text-dark-muted">{feature.free}</div>
            <div className="text-center font-bold text-white">{feature.premium}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="">
      <button 
        className="w-full flex items-center justify-between p-5 text-left font-medium text-dark-text hover:text-white transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{question}</span>
        <MdKeyboardArrowDown className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={20} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="text-sm text-dark-muted leading-relaxed px-5 pb-5 pt-0">
          {answer}
        </p>
      </div>
    </div>
  );
};

export const PremiumSettings = () => {
  const { info } = useToast();
  const benefits = [
    {
      icon: MdScreenShare,
      title: "HD Screen Sharing",
      description: "Share your screen in 1080p 60fps quality with friends.",
      color: "text-blue-400",
      bg: "bg-blue-400/10"
    },
    {
      icon: MdDiamond,
      title: "Exclusive Profile Badge",
      description: "Stand out with the shiny Premium badge on your profile.",
      color: "text-purple-400",
      bg: "bg-purple-400/10"
    },
    {
      icon: MdStar,
      title: "Custom Profile Backgrounds",
      description: "Personalize your profile with custom banner images.",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10"
    },
    {
      icon: MdEmojiEmotions,
      title: "Exclusive Stickers",
      description: "Access a library of premium stickers and custom emojis.",
      color: "text-orange-400",
      bg: "bg-orange-400/10"
    },
    {
      icon: MdGraphicEq,
      title: "Soundboard",
      description: "Play fun sound effects in voice channels.",
      color: "text-pink-400",
      bg: "bg-pink-400/10"
    },
    {
      icon: MdSupportAgent,
      title: "Priority Support",
      description: "Get faster responses for all your support tickets.",
      color: "text-green-400",
      bg: "bg-green-400/10"
    }
  ];

  const faqs = [
    { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time from your account settings. Your benefits will continue until the end of the billing period." },
    { q: "Is payment secure?", a: "Absolutely. We use Stripe for payment processing, which is the industry standard for security. We never store your card details." },
    { q: "Do benefits apply to all servers?", a: "Yes! Your Premium benefits travel with you to any server you join on Lumo Chat." },
  ];

  return (
    <div className="animate-fade-in pb-10">
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .shine-effect::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent);
          transform: skewX(-20deg) translateX(-150%);
          animation: shine 3s infinite;
        }
        .float-animation {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>

      {/* Hero Header - Full Width */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-2xl transform transition-all hover:scale-[1.005] mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-black/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="float-animation p-5 bg-white/10 backdrop-blur-md rounded-full shadow-inner ring-4 ring-white/20 shrink-0">
            <MdRocketLaunch size={56} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 drop-shadow-md">
              Release the <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">Boost!</span>
            </h1>
            <p className="text-indigo-100 font-medium text-lg leading-relaxed max-w-2xl">
              Unlock the full potential of Lumo Chat. Get special perks, enhanced quality, and support the development.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Column: Perks & Pricing */}
        <div className="space-y-8">
           {/* Benefits Grid */}
          <div>
            <h2 className="text-xl font-bold text-dark-text mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-brand-primary rounded-full box-shadow-glow"></span>
              Premium Perks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="group relative overflow-hidden p-5 rounded-xl bg-dark-sidebar border border-dark-hover hover:border-brand-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-brand-primary/10 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none"></div>
                  
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${benefit.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <benefit.icon size={28} className={`${benefit.color} drop-shadow-sm`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-text mb-1 group-hover:text-white transition-colors text-lg">{benefit.title}</h3>
                      <p className="text-sm text-dark-muted leading-relaxed group-hover:text-gray-300">{benefit.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Card */}
          <div className="bg-dark-bg rounded-2xl p-1 border-2 border-brand-primary/30 group hover:border-brand-primary/60 transition-colors relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 transition-opacity"></div>
            
            <div className="bg-dark-sidebar/90 backdrop-blur-xl rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-[10px] font-bold text-white uppercase tracking-widest mb-3 shadow-lg">
                  BEST VALUE
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">Monthly</h3>
                <p className="text-dark-muted text-sm flex items-center gap-2">
                  <MdCheck size={16} className="text-green-500" /> Secure payment
                </p>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <div className="text-4xl font-extrabold text-white">
                    $4.99<span className="text-sm text-dark-muted font-normal ml-1">/mo</span>
                </div>
                
                <button 
                  className="relative overflow-hidden px-10 py-4 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 rounded-xl text-white font-bold shadow-lg transform transition-all hover:scale-105 active:scale-95 shine-effect whitespace-nowrap"
                  onClick={() => info('Ödeme sistemi şu anda bakımda.')}
                >
                  <span className="relative z-10 flex items-center gap-2">
                      Subscribe Now <MdRocketLaunch />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Comparison & FAQ */}
        <div className="space-y-8">
           <div>
              <h2 className="text-xl font-bold text-dark-text mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-purple-500 rounded-full box-shadow-glow"></span>
                Why Go Premium?
              </h2>
              <ComparisonTable />
           </div>

        </div>
      </div>

      {/* FAQ Section - Full Width at Bottom */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-dark-text mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-gray-500 rounded-full"></span>
          Common Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-dark-sidebar rounded-xl border border-dark-hover overflow-hidden">
               <FAQItem question={faq.q} answer={faq.a} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
