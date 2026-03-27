import { Link } from "react-router-dom";
import { 
  Activity, 
  Zap, 
  Shield, 
  BarChart3, 
  ArrowRight,
  Upload,
  FileCheck,
  Play
} from "lucide-react";
import { Button } from "../component/button";

export function Home() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">K6 LoadTest</span>
            </div>
            <Link to="/upload">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center space-y-8">
          <div className="inline-block">
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 backdrop-blur-xl">
              <span className="text-sm text-blue-400">DevOps Performance Testing Platform</span>
            </div>
          </div>
          
          <h1 className="text-7xl font-bold text-white tracking-tight">
            Load Test Your APIs
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              At Scale
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Upload your API specifications and run comprehensive load tests with k6. 
            Get detailed performance metrics and insights in minutes.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/upload">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-14 px-8 text-lg">
                Start Testing Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 bg-white/5 text-white hover:bg-white/10">
              View Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl hover:border-blue-500/30 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6">
                <Upload className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Easy Upload</h3>
              <p className="text-gray-400 leading-relaxed">
                Simply upload your API PDF and CSS files. We automatically detect and parse all endpoints.
              </p>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl hover:border-purple-500/30 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Parallel Testing</h3>
              <p className="text-gray-400 leading-relaxed">
                Execute load tests in parallel using worker-based system powered by k6 for maximum efficiency.
              </p>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-600/20 to-red-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl hover:border-pink-500/30 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-6">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Rich Analytics</h3>
              <p className="text-gray-400 leading-relaxed">
                Get comprehensive metrics including RPS, latency percentiles, error rates, and SLO compliance.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Simple workflow to test your APIs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Upload, title: "Upload Files", desc: "Upload API PDF & CSS files", color: "from-blue-500 to-cyan-500" },
              { icon: FileCheck, title: "Confirm APIs", desc: "Review detected endpoints", color: "from-purple-500 to-pink-500" },
              { icon: Play, title: "Run Tests", desc: "Select test mode & execute", color: "from-pink-500 to-red-500" },
              { icon: BarChart3, title: "View Results", desc: "Analyze dashboard & export", color: "from-orange-500 to-yellow-500" },
            ].map((step, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-2xl`}>
                    <step.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-500 font-semibold">STEP {index + 1}</div>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                    <p className="text-sm text-gray-400">{step.desc}</p>
                  </div>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-white/20 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-32 p-12 rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                99.9%
              </div>
              <div className="text-gray-400">Accuracy Rate</div>
            </div>
            <div className="text-center border-x border-white/5">
              <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                10k+
              </div>
              <div className="text-gray-400">APIs Tested</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text text-transparent mb-2">
                &lt;5min
              </div>
              <div className="text-gray-400">Average Test Time</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 backdrop-blur-xl bg-black/20 mt-32">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="text-gray-500 text-sm">
              © 2026 K6 LoadTest Platform. All rights reserved.
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Shield className="w-4 h-4" />
              <span>Powered by k6</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
