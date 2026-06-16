'use client'

import { motion } from "framer-motion"
import { Star, Quote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const testimonials = [
	{
		name: "Sarah Johnson",
		role: "CEO, TechStart Inc.",
		avatar: "/avatars/sarah.jpg",
		content:
			"Chronida transformed our operations completely. We've seen 40% improvement in productivity and our team loves the intuitive interface.",
		rating: 5,
		company: "TechStart Inc.",
	},
	{
		name: "Michael Chen",
		role: "Operations Manager",
		avatar: "/avatars/michael.jpg",
		content:
			"The inventory management features are outstanding. Real-time tracking and automated reordering have saved us countless hours.",
		rating: 5,
		company: "Global Logistics",
	},
	{
		name: "Emily Rodriguez",
		role: "HR Director",
		avatar: "/avatars/emily.jpg",
		content:
			"Employee management has never been easier. The attendance tracking and payroll integration work flawlessly together.",
		rating: 5,
		company: "Innovation Labs",
	},
]

export function Testimonials() {
	return (
		<section id="testimonials" className="py-16 sm:py-20 lg:py-24 bg-slate-50">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="text-center mb-12 sm:mb-16 lg:mb-20"
				>
					<h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
						Loved by Teams Worldwide
					</h2>
					<p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto">
						Don&apos;t just take our word for it. See what our customers have to
						say about their experience.
					</p>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
					{testimonials.map((testimonial, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: index * 0.1 }}
							className="w-full"
						>
							<Card className="h-full hover:shadow-none transition-all duration-300 border-0 shadow-none">
								<CardContent className="p-6 sm:p-8">
									<div className="flex items-center mb-4">
										{[...Array(testimonial.rating)].map((_, i) => (
											<Star
												key={i}
												className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400"
											/>
										))}
									</div>

									<Quote className="w-6 h-6 sm:w-8 sm:h-8 text-blue-200 mb-4" />

									<p className="text-slate-700 mb-6 leading-relaxed text-sm sm:text-base">
										&ldquo;{testimonial.content}&rdquo;
									</p>

									<div className="flex items-center">
										<Avatar className="w-10 h-10 sm:w-12 sm:h-12 mr-3 sm:mr-4 flex-shrink-0">
											<AvatarImage src={testimonial.avatar} />
											<AvatarFallback>
												{testimonial.name
													.split(" ")
													.map((n) => n[0])
													.join("")}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="font-semibold text-slate-900 text-sm sm:text-base truncate">
												{testimonial.name}
											</div>
											<div className="text-xs sm:text-sm text-slate-600 truncate">
												{testimonial.role}
											</div>
											<div className="text-xs text-blue-600 truncate">
												{testimonial.company}
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	)
}

